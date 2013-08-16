connect-tedious [![Build Status](https://secure.travis-ci.org/mcartoixa/connect-tedious.png)](https://travis-ci.org/mcartoixa/connect-tedious)
===============

[connect](https://github.com/senchalabs/connect) session store for SQL Server, using [tedious](http://github.com/pekim/tedious).

## Usage


```javascript
var express = require('express');
var TediousStore = require('connect-tedious')(express);

var app = express.createServer()
    .use(express.cookieParser())
    .use(express.session({
        secret: 'mysecret',
        store: new TediousStore({
            config: {
                userName: 'mydbuser',
                password: 'mydbpassword',
                server: 'localhost',
                options: {
                  instanceName: 'SQLEXPRESS',
                  database: 'mydatabase'
                }
            }
        })
    )
);
```

## License

View the [LICENSE](https://github.com/mcartoixa/connect-tedious/blob/master/LICENSE) file