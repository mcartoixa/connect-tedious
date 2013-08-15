/*!
 * Connect - Tedious
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var tedious = require('tedious');
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

    this.connection = new tedious.Connection(options.config);
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
    var r = new tedious.Request(
      'SELECT s.' + this.sessColumnName + ' FROM ' + this.tableName + ' WHERE ' + this.sidColumnName + '=@sid AND ' + this.expiredColumnName + '>=SYSUTCDATETIME()',
      function(err, rowCount) {
        if (err)
          return fn(err);
        if (!rowCount || rowCount!==1) 
          return  fn();
      }
    );
    r.on('row', function(columns) {
      if (!columns || columns.length!==1)
        return fn();
      return JSON.parse(Columns[0].value);
    });
    r.addParameter('sid', TYPES.VarChar, sid);
    this.connection.execSql(r);
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
    var maxAge = sess.cookie.maxAge;
    var now = new Date().getTime();
    var duration = maxAge || oneDay;

    var r = new tedious.Request(
      'MERGE INTO ' + this.tableName + ' s WITH (HOLDLOCK)' +
      '  USING ' + this.tableName + ' us ON (s.' + this.sidColumnName + '=us.Id AND s.' + this.sidColumnName + '=@sid)' +
      '  WHEN MATCHED THEN UPDATE SET s.' + this.sessColumnName + '=@session, s.' + this.expiredColumnName + '=DATEADD(ss, @duration, SYSUTCDATETIME())' +
      '  WHEN NOT MATCHED THEN INSERT (' + this.sidColumnName + ', ' + this.sessColumnName + ', ' + this.expiredColumnName + ') VALUES (@sid, @sess, DATEADD(ss, @duration, SYSUTCDATETIME()))',
      function(err) {
        if (err)
          return fn(err);
      }
    );
    r.addParameter('sid', TYPES.VarChar, sid);
    r.addParameter('sess', TYPES.NVarChar, sess);
    r.addParameter('duration', TYPES.Int, duration);
    this.connection.execSql(r);
  };

  /**
   * Destroy the session associated with the given `sid`.
   *
   * @param {String} sid
   * @api public
   */

  TediousStore.prototype.destroy = function(sid, fn){
    var r = new tedious.Request(
      'DELETE FROM ' + this.tableName + ' s WHERE ' + this.sidColumnName + '=@sid',
      function(err) {
        if (err)
          return fn(err);
      }
    );
    r.addParameter('sid', TYPES.VarChar, sid);
    this.connection.execSql(r);
  };

  /**
   * Fetch number of sessions.
   *
   * @param {Function} fn
   * @api public
   */

  SQLiteStore.prototype.length = function(fn){
    var r = new tedious.Request(
      'SELECT @count=COUNT(*) FROM ' + this.tableName,
      function(err, rowCount) {
        if (err)
          return fn(err);
        if (!rowCount || rowCount!==1) 
          return  fn();
      }
    );
    r.on('returnValue', function(parameterName, value, metadata) {
      if (!value)
        return fn();
      return value;
    });
    request.addOutputParameter('count', TYPES.Int);
    this.connection.execSql(r);
  };


  /**
   * Clear all sessions.
   *
   * @param {Function} fn
   * @api public
   */

  SQLiteStore.prototype.clear = function(fn){
    var r = new tedious.Request(
      'DELETE FROM ' + this.tableName,
      function(err) {
        if (err)
          return fn(err);
      }
    );
    this.connection.execSql(r);
  };

  return TediousStore;
};
