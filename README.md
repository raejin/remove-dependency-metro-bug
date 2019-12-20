## How to reproduce the Metro bug

### STEP 1
`yarn test` - this will run the server.

### STEP 2
visit http://localhost:8888/graph/example/E.js to get dependency graph

### STEP 3
Comment/remove `require('./B')` from `E.js` like so:
```js
//require('./B')
require('./U')
```

### STEP 4
visit http://localhost:8888/graph/example/E.js again to get an updated dependency graph


