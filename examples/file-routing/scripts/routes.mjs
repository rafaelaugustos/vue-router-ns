import options from '../file-routing.config.js'
import { prepareFileRouting } from 'vue-router-ns/file-routing/setup'
await prepareFileRouting(options(process.argv[2]))
