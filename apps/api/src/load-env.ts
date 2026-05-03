import { loadEnv } from '@dm-forge/shared'

// Side-effect import: carrega o .env (com expansão de ${...}) ANTES de
// qualquer leitura de process.env. Deve ser o primeiro import do entrypoint.
loadEnv()
