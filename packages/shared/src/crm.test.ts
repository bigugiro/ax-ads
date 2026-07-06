import { describe, expect, it } from 'vitest';
import {
  acaoAutomacaoSchema,
  atualizarLeadSchema,
  condicoesAutomacaoSchema,
  condicoesBatem,
  criarAutomacaoSchema,
  gatilhoAutomacaoSchema,
} from './crm';

describe('condicoesBatem (motor de regras — puro)', () => {
  it('sem condições, dispara sempre', () => {
    expect(condicoesBatem({}, { origem: 'meta_ads' })).toBe(true);
    expect(condicoesBatem({}, { origem: 'qualquer', estagioNome: 'Novo' })).toBe(true);
  });

  it('condição de origem só bate com a origem exata', () => {
    expect(condicoesBatem({ origem: 'meta_ads' }, { origem: 'meta_ads' })).toBe(true);
    expect(condicoesBatem({ origem: 'meta_ads' }, { origem: 'google_ads' })).toBe(false);
  });

  it('condição de estágio só bate com o estágio de destino', () => {
    expect(
      condicoesBatem({ estagio_nome: 'Contatado' }, { origem: 'x', estagioNome: 'Contatado' }),
    ).toBe(true);
    expect(
      condicoesBatem({ estagio_nome: 'Contatado' }, { origem: 'x', estagioNome: 'Proposta' }),
    ).toBe(false);
    // Contexto sem estagioNome (ex.: gatilho lead_criado) nunca bate condição de estágio.
    expect(condicoesBatem({ estagio_nome: 'Contatado' }, { origem: 'x' })).toBe(false);
  });

  it('TODAS as condições declaradas precisam bater (AND)', () => {
    const condicoes = { origem: 'meta_ads', estagio_nome: 'Novo' };
    expect(condicoesBatem(condicoes, { origem: 'meta_ads', estagioNome: 'Novo' })).toBe(true);
    expect(condicoesBatem(condicoes, { origem: 'meta_ads', estagioNome: 'Proposta' })).toBe(false);
    expect(condicoesBatem(condicoes, { origem: 'google_ads', estagioNome: 'Novo' })).toBe(false);
  });
});

describe('schemas de automação', () => {
  it('condicoesAutomacaoSchema rejeita chaves desconhecidas (strict)', () => {
    expect(condicoesAutomacaoSchema.safeParse({ origem: 'meta_ads' }).success).toBe(true);
    expect(condicoesAutomacaoSchema.safeParse({}).success).toBe(true);
    expect(condicoesAutomacaoSchema.safeParse({ campo_invalido: 'x' }).success).toBe(false);
  });

  it('acaoAutomacaoSchema valida o discriminated union por tipo', () => {
    expect(
      acaoAutomacaoSchema.safeParse({ tipo: 'mudar_estagio', estagio_nome: 'Proposta' }).success,
    ).toBe(true);
    expect(acaoAutomacaoSchema.safeParse({ tipo: 'definir_status', status: 'ganho' }).success).toBe(
      true,
    );
    expect(
      acaoAutomacaoSchema.safeParse({ tipo: 'criar_evento', descricao: 'Ligamos' }).success,
    ).toBe(true);
    expect(
      acaoAutomacaoSchema.safeParse({ tipo: 'definir_status', status: 'invalido' }).success,
    ).toBe(false);
    expect(acaoAutomacaoSchema.safeParse({ tipo: 'mudar_estagio' }).success).toBe(false);
    expect(acaoAutomacaoSchema.safeParse({ tipo: 'apagar_tudo' }).success).toBe(false);
  });

  it('gatilhoAutomacaoSchema cobre lead_criado e lead_mudou_estagio', () => {
    expect(gatilhoAutomacaoSchema.safeParse('lead_criado').success).toBe(true);
    expect(gatilhoAutomacaoSchema.safeParse('lead_mudou_estagio').success).toBe(true);
    expect(gatilhoAutomacaoSchema.safeParse('lead_parado').success).toBe(false);
  });

  it('criarAutomacaoSchema exige ao menos uma ação', () => {
    const base = {
      cliente_id: '3f9a2c4e-8b1d-4f6a-9c3e-2d5b7a891234',
      nome: 'Boas-vindas Meta Ads',
      gatilho: 'lead_criado',
    };
    expect(criarAutomacaoSchema.safeParse({ ...base, acoes: [] }).success).toBe(false);
    expect(
      criarAutomacaoSchema.safeParse({
        ...base,
        acoes: [{ tipo: 'mudar_estagio', estagio_nome: 'Contatado' }],
      }).success,
    ).toBe(true);
  });
});

describe('atualizarLeadSchema', () => {
  it('exige ao menos um campo', () => {
    expect(atualizarLeadSchema.safeParse({}).success).toBe(false);
    expect(atualizarLeadSchema.safeParse({ status: 'ganho' }).success).toBe(true);
    expect(atualizarLeadSchema.safeParse({ valor: 500 }).success).toBe(true);
  });
});
