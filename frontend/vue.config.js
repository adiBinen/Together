// vue.config.js
module.exports = {
    pwa: {
      workboxPluginMode: 'InjectManifest',
      workboxOptions: {
          swSrc: 'src/service-worker.js'
      },
      themeColor: '#8bc34a'
    },
  }