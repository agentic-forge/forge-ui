import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { definePreset } from '@primevue/themes'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import 'primeicons/primeicons.css'

import App from './App.vue'
import './assets/styles.css'

// Minimal customization - just use violet as primary color
// Aura handles dark mode automatically
const ForgePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{violet.50}',
      100: '{violet.100}',
      200: '{violet.200}',
      300: '{violet.300}',
      400: '{violet.400}',
      500: '{violet.500}',
      600: '{violet.600}',
      700: '{violet.700}',
      800: '{violet.800}',
      900: '{violet.900}',
      950: '{violet.950}',
    },
  },
})

const app = createApp(App)

app.use(PrimeVue, {
  theme: {
    preset: ForgePreset,
    options: {
      darkModeSelector: '.app-dark',
    },
  },
})

app.use(ToastService)
app.use(ConfirmationService)

app.mount('#app')
