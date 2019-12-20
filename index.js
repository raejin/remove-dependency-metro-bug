const Metro = require('metro');
const url = require('url');
const splitBundleOptions = require('metro/src/lib/splitBundleOptions');
const transformHelpers = require('metro/src/lib/transformHelpers');
const getGraphId = require('metro/src/lib/getGraphId');
const parseOptionsFromUrl = require('metro/src/lib/parseOptionsFromUrl');
const { getDefaultConfig, mergeConfig } = require('metro-config');

async function initializeGraph(
  processedReqUrl,
  metroServer,
) {

  const { entryFile, transformOptions, onProgress, graphOptions } = splitBundleOptions(parseOptionsFromUrl(
    processedReqUrl,
    // eslint-disable-next-line no-underscore-dangle
    new Set(['node']),
  ));
  const incrementalBundler = metroServer.getBundler();
  const resolutionFn = await transformHelpers.getResolveDependencyFn(
    incrementalBundler.getBundler(),
    transformOptions.platform,
  );
  const resolvedEntryFilePath = resolutionFn(`${metroServer._config.projectRoot}/.`, entryFile);

  const graphId = getGraphId(resolvedEntryFilePath, transformOptions, {
    shallow: graphOptions.shallow,
    experimentalImportBundleSupport: false,
  });

  const revPromise = incrementalBundler.getRevisionByGraphId(graphId);

  const graphResult = await (revPromise != null
      ? incrementalBundler.updateGraph(await revPromise, false)
      : incrementalBundler.initializeGraph(resolvedEntryFilePath, transformOptions, {
          onProgress,
          shallow: graphOptions.shallow,
        }));

  return graphResult;
}

function makeMetroMiddleware(processRequest, metroServer) {
  return async (req, res, next) => {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '';
    if (pathname.match(/^\/graph\//)) {
      const graph = await initializeGraph(
        url.format({
          ...parsedUrl,
          pathname: parsedUrl.pathname.replace(/^\/graph\//, '/'),
          query: {
            ...parsedUrl.query,
            platform: 'node',
          },
          search: undefined,
        }),
        metroServer,
      );

      res.end(JSON.stringify({
        delta: {
          added: graph.delta.added.size,
          modified: graph.delta.modified.size,
          deleted: graph.delta.deleted.size,
        },
        dependencies: Array.from(graph.revision.graph.dependencies.keys()),
        entryPoints: graph.revision.graph.entryPoints,
      }));
    } else {
      next();
    }
  };
}

async function run() {
  const defaultConfig = await getDefaultConfig(__dirname);
  const metroConfig = mergeConfig(defaultConfig, {
    server: {
      port: process.env.PORT,
      enhanceMiddleware: makeMetroMiddleware,
    },
    watchFolders: [__dirname],
  });

  Metro.runServer(metroConfig, { onReady() {console.info('Metro server ready!')} })
}

run();
