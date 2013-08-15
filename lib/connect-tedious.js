/*!
 * Connect - Tedious
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var tedious = require('tedious');
var generic_pool = require('generic-pool');
var debug = require('debug')('connect-tedious');

/**
 * One day in seconds.
 */

var oneDay = 86400;

/**
 * Return the `RedisStore` extending `connect`'s session Store.
 *
 * @param {object} connect
 * @return {Function}
 * @api public
 */

module.exports = function(connect){

  /**
   * Connect's Store.
   */

  var Store = connect.session.Store;

  /**
   * Initialize TediousStore with the given `options`.
   *
   * @param {Object} options
   * @api public
   */

  function TediousStore(options) {
    options = options || {};
    Store.call(this, options);

    this.tableName=options.tableName || '[dbo].[Sessions]';
    this.sidColumnName=options.sidColumnName || '[Sid]';
    this.sessColumnName=options.sessColumnName || '[Sess]';
    this.expiredColumnName=options.expiredColumnName || '[Expired]';

    this.pool = generic_pool.Pool({
        name: 'connect-tedious',
        min: options.minConnections || 0,
        max: options.maxConnections || 100,
        idleTimeout: options.idleTimeout || 30000,
        //log: true,
        create: function(callback) {
          var c=new tedious.Connection(
            options.config
          ).on('connect', function(err) {
            callback(err, c);
          }).on('errorMessage', function(error) {
            debug('ERROR '+error.message);
          }).on('infoMessage', function(info) {
            debug('INFO '+info.message);
          }).on('debug', function(messageText) {
            debug('DEBUG '+messageText);
          });
        },
        destroy: function(db) {
          db.close();
        }
    });
  };

  /**
   * Inherit from `Store`.
   */

  TediousStore.prototype.__proto__ = Store.prototype;

  /**
   * Attempt to fetch session by the given `sid`.
   *
   * @param {String} sid
   * @param {Function} fn
   * @api public
   */

  TediousStore.prototype.get = function(sid, fn) {
    var self=this;
    self.pool.acquire(function(err, db) {
        if (err) {
          self.pool.release(db);
          return fn(err);
        }

        var r = new tedious.Request(
          'SELECT s.' + self.sessColumnName + ' FROM ' + self.tableName + ' s WHERE s.' + self.sidColumnName + '=@sid AND s.' + self.expiredColumnName + '>=SYSUTCDATETIME()',
          function(err, rowCount) {
            self.pool.release(db);
            if (err)
              return fn(err);
            if (!rowCount || rowCount!==1) 
              return  fn();
          }
        );
        r.on('row', function(columns) {
          if (!columns || columns.length!==1)
            return fn();
          return fn(null, JSON.parse(columns[0].value));
        });
        r.addParameter('sid', tedious.TYPES.VarChar, sid);

        debug('Executing '+r.sqlTextOrProcedure);
        db.execSql(r);
    });
  };

  /**
   * Commit the given `sess` object associated with the given `sid`.
   *
   * @param {String} sid
   * @param {Session} sess
   * @param {Function} fn
   * @api public
   */

  TediousStore.prototype.set = function(sid, sess, fn){
    var self=this;
    self.pool.acquire(function(err, db) {
        if (err) {
          self.pool.release(db);
          return fn(err);
        }

        var duration = sess.cookie.maxAge || oneDay;
        var r = new tedious.Request(
          'MERGE INTO ' + self.tableName + ' WITH (HOLDLOCK) s' +
          '  USING (VALUES(@sid, @sess)) ns(' + self.sidColumnName + ', ' + self.sessColumnName + ') ON (s.' + self.sidColumnName + '=ns.' + self.sidColumnName + ')' +
          '  WHEN MATCHED THEN UPDATE SET s.' + self.sessColumnName + '=@sess, s.' + self.expiredColumnName + '=DATEADD(ss, @duration, SYSUTCDATETIME())' +
          '  WHEN NOT MATCHED THEN INSERT (' + self.sidColumnName + ', ' + self.sessColumnName + ', ' + self.expiredColumnName + ') VALUES (@sid, @sess, DATEADD(ss, @duration, SYSUTCDATETIME()));',
          function(err) {
            self.pool.release(db);
            fn.apply(self, arguments);
          }
        );
        r.addParameter('sid', tedious.TYPES.VarChar, sid);
        r.addParameter('sess', tedious.TYPES.NVarChar, sess);
        r.addParameter('duration', tedious.TYPES.Int, duration);


        debug('Executing '+r.sqlTextOrProcedure);
        debug('@duration: '+duration);
        db.execSql(r);
    });
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  TediousStore.prototype.destroy = function(sid, fn){
    var self=this;
    self.pool.acquire(function(err, db) {
        if (err) {
          self.pool.release(db);
          return fn(err);
        }

        var r = new tedious.Request(
          'DELETE FROM ' + self.tableName + ' s WHERE ' + self.sidColumnName + '=@sid',
          function(err) {
            self.pool.release(db);
            if (err)
              return fn(err);
            return fn(err, true);
          }
        );
        r.addParameter('sid', tedious.TYPES.VarChar, sid);

        debug('Executing '+r.sqlTextOrProcedure);
        db.execSql(r);
    });
  };

  /**
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */

  TediousStore.prototype.length = function(fn){
    var self=this;
    self.pool.acquire(function(err, db) {
        if (err) {
          self.pool.release(db);
          return fn(err);
        }

        var r = new tedious.Request(
          'SELECT @count=COUNT(*) FROM ' + self.tableName,
          function(err, rowCount) {
            if (err)
              return fn(err);
            if (!rowCount || rowCount!==1) 
              return  fn();
          }
        );
        r.on('returnValue', function(parameterName, value, metadata) {
          self.pool.release(db);
          if (!value)
            return fn();
          return fn(null, value);
        });
        request.addOutputParameter('count', tedious.TYPES.Int);

        debug('Executing '+r.sqlTextOrProcedure);
        db.execSql(r);
    });
  };


  /**
   * Clear all sessions.
   *
   * @param {Function} fn
   * @api public
   */

  TediousStore.prototype.clear = function(fn){
    var self=this;
    self.pool.acquire(function(err, db) {
        if (err) {
          self.pool.release(db);
          return fn(err);
        }

        var r = new tedious.Request(
          'DELETE FROM ' + self.tableName,
          function(err) {
            self.pool.release(db);
            if (err)
              return fn(err);
            fn(null, true);
          }
        );

        debug('Executing '+r.sqlTextOrProcedure);
        db.execSql(r);
    });
  };

  return TediousStore;
};
