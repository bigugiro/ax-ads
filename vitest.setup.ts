// Carrega variáveis de .env para os testes de integração (silencioso se não existir).
// Segredos nunca entram no repo — apenas no .env local / secrets do CI.
import { config } from 'dotenv';

// .env.local tem prioridade (segredos reais); .env é fallback. Silencioso se faltar.
config({ path: ['.env.local', '.env'] });
