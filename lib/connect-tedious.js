/*!
 * Connect - Tedious
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var tedious=require('tedious');
var tediousPool=require('tedious-connection-pool');
var debug={
    connection: require('debug')('connect-tedious:connection'),
    sql: require('debug')('connect-tedious:sql')
};

/**
 * One day in seconds.
 */
var oneDay = 86400;

function initConnection(c) {
    if (!c)
        return;

    c.on('errorMessage', function(error) {
      console.error('ERROR '+error.message);
    }).on('infoMessage', function(info) {
      debug.connection('INFO '+info.message);
    }).on('debug', function(messageText) {
      debug.connection('DEBUG '+messageText);
    });
}

function debugSql(r) {
    if (!r)
        return;

    debug.sql('Executing '+r.sqlTextOrProcedure);

    var _i, _len;
    for (_i=0, _len=r.parameters.length; _i<_len; _i++) {
        var p=r.parameters[_i];
        debug.sql('@'+p.name+': '+p.value);
    }
}

/**
 * Return the `TediousStore` extending `connect`'s session Store.
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
    this.expiresColumnName=options.expiresColumnName || '[Expires]';

    this.pool=new tediousPool(
        {
            name: 'connect-tedious',
            min: options.minConnections || 0,
            max: options.maxConnections || 100,
            idleTimeout: options.idleTimeout || 30000
        },
        options.config
     );
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
    self.pool.requestConnection(function(err, db) {
        if (err)
          return fn(err);
        initConnection(db);

        var r = new tedious.Request(
          'SELECT s.' + self.sessColumnName + ' FROM ' + self.tableName + ' s WHERE s.' + self.sidColumnName + '=@sid AND s.' + self.expiresColumnName + '>=SYSUTCDATETIME()',
          function(err, rowCount) {
            debug.sql("Executed SELECT");
            db.close();
            if (err)
              return fn(err);
            if (!rowCount || rowCount!==1) 
              return  fn();
          }
        );
        r.on('row', function(columns) {
          if (!columns || columns.length!==1)
            return fn();

          var v=columns[0].value;
          debug.sql("Returning "+v);
          return fn(null, JSON.parse(v));
        });
        r.addParameter('sid', tedious.TYPES.VarChar, sid);

        debugSql(r);
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
    self.pool.requestConnection(function(err, db) {
        if (err)
          return fn(err);
        initConnection(db);

        var duration = sess.cookie.maxAge || oneDay;
        var r = new tedious.Request(
          'MERGE INTO ' + self.tableName + ' WITH (HOLDLOCK) s' +
          '  USING (VALUES(@sid, @sess)) ns(' + self.sidColumnName + ', ' + self.sessColumnName + ') ON (s.' + self.sidColumnName + '=ns.' + self.sidColumnName + ')' +
          '  WHEN MATCHED THEN UPDATE SET s.' + self.sessColumnName + '=@sess, s.' + self.expiresColumnName + '=DATEADD(ss, @duration, SYSUTCDATETIME())' +
          '  WHEN NOT MATCHED THEN INSERT (' + self.sidColumnName + ', ' + self.sessColumnName + ', ' + self.expiresColumnName + ') VALUES (@sid, @sess, DATEADD(ss, @duration, SYSUTCDATETIME()));',
          function(err) {
            debug.sql("Executed MERGE");
            db.close();
            fn.apply(self, arguments);
          }
        );
        r.addParameter('sid', tedious.TYPES.VarChar, sid);
        r.addParameter('sess', tedious.TYPES.NVarChar, JSON.stringify(sess));
        r.addParameter('duration', tedious.TYPES.Int, duration);

        debugSql(r);
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
    self.pool.requestConnection(function(err, db) {
        if (err)
          return fn(err);
        initConnection(db);

        var r = new tedious.Request(
          'DELETE FROM ' + self.tableName + ' s WHERE s.' + self.sidColumnName + '=@sid',
          function(err) {
            debug.sql("Executed DELETE");
            db.close();
            if (err)
              return fn(err);
            return fn(err, true);
          }
        );
        r.addParameter('sid', tedious.TYPES.VarChar, sid);

        debugSql(r);
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
    self.pool.requestConnection(function(err, db) {
        if (err)
          return fn(err);
        initConnection(db);

        var r = new tedious.Request(
          'SELECT @count=COUNT(*) FROM ' + self.tableName,
          function(err, rowCount) {
            debug.sql("Executed SELECT");
            db.close();
            if (err)
              return fn(err);
            if (!rowCount || rowCount!==1) 
              return  fn();
          }
        );
        r.on('returnValue', function(parameterName, value, metadata) {
          if (!value)
            return fn();
          return fn(null, value);
        });
        request.addOutputParameter('count', tedious.TYPES.Int);

        debugSql(r);
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
    self.pool.requestConnection(function(err, db) {
        if (err)
          return fn(err);
        initConnection(db);

        var r = new tedious.Request(
          'DELETE FROM ' + self.tableName,
          function(err) {
            debug.sql("Executed DELETE");
            db.close();
            if (err)
              return fn(err);
            fn(null, true);
          }
        );

        debugSql(r);
        db.execSql(r);
    });
  };

  return TediousStore;
};
