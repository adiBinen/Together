import Vue from 'vue'
import ElementUI from 'element-ui';
import 'element-ui/lib/theme-chalk/index.css';
import locale from 'element-ui/lib/locale/lang/en';
import App from './App.vue'
import router from './router'
import store from './store'
import './filter'
import './registerServiceWorker'
import '@/assets/css/main.scss';
import '@/services/PushNotificationService';


Vue.config.productionTip = false

Vue.use(ElementUI, {locale});

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
