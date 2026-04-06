import { pkg, get, create, edit, remove } from 'unipatch'

import hekate from './recipie/hekate'
import atmosphere from './recipie/atmosphere'
import homebrew from './recipie/homebrew'
const pipeline = pkg()
    .put(...hekate)
    .put(...atmosphere)
    .put(...homebrew)

// Execute the pipeline
await pipeline.execute()
