/** Onboarding self-service (Sprint 9): cria conta, agência e assinatura numa
 *  chamada só, depois loga automaticamente — sem intervenção manual. */
import { formatarPrecoPlano } from '@ax-ads/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { PoweredByAX, Wordmark } from '../components/Wordmark';
import { apiPostPublico, ApiError } from '../lib/api';

type PlanoPago = 'starter' | 'pro' | 'agency';

const PLANOS: { valor: PlanoPago; nome: string; destaque?: boolean }[] = [
  { valor: 'starter', nome: 'Starter' },
  { valor: 'pro', nome: 'Pro', destaque: true },
  { valor: 'agency', nome: 'Agency' },
];

const signupFormSchema = z.object({
  nome_agencia: z.string().trim().min(1, 'Obrigatório').max(120),
  nome: z.string().trim().min(1, 'Obrigatório').max(120),
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
  plano: z.enum(['starter', 'pro', 'agency']),
  aceite_termos: z
    .boolean()
    .refine((v) => v, { message: 'É preciso aceitar os Termos de Uso e a Política de Privacidade' }),
});
type SignupForm = z.infer<typeof signupFormSchema>;

export function SignupPage() {
  const { entrar, session, carregando } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { plano: 'pro', aceite_termos: false },
  });
  const planoEscolhido = watch('plano');

  if (!carregando && session) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async (form) => {
    setErro(null);
    try {
      await apiPostPublico('/auth/signup', {
        nome_agencia: form.nome_agencia,
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        plano: form.plano,
        aceite_termos: form.aceite_termos,
      });
      await entrar(form.email, form.senha);
      navigate('/', { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar a conta. Tenta de novo.');
    }
  });

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <Wordmark size="text-4xl" />
          </div>
          <p className="mt-2 text-base text-content-2">Crie sua conta e comece a disparar.</p>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="card space-y-4 p-6" noValidate>
          <div>
            <label htmlFor="nome_agencia" className="mb-1 block text-sm font-medium">
              Nome da agência
            </label>
            <input id="nome_agencia" className="field" {...register('nome_agencia')} />
            {errors.nome_agencia && (
              <p className="mt-1 text-sm text-danger">{errors.nome_agencia.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="nome" className="mb-1 block text-sm font-medium">
              Seu nome
            </label>
            <input id="nome" className="field" {...register('nome')} />
            {errors.nome && <p className="mt-1 text-sm text-danger">{errors.nome.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              className="field"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-sm text-danger">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="senha" className="mb-1 block text-sm font-medium">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              autoComplete="new-password"
              className="field"
              {...register('senha')}
            />
            {errors.senha && <p className="mt-1 text-sm text-danger">{errors.senha.message}</p>}
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium">Plano</legend>
            <div className="grid grid-cols-3 gap-2">
              {PLANOS.map((p) => (
                <button
                  key={p.valor}
                  type="button"
                  onClick={() => setValue('plano', p.valor)}
                  className={`rounded-xl border p-2.5 text-center transition ${
                    planoEscolhido === p.valor
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-content-2'
                  }`}
                >
                  <p className="text-sm font-bold">{p.nome}</p>
                  <p className="text-[11px]">{formatarPrecoPlano(p.valor)}/mês</p>
                </button>
              ))}
            </div>
          </fieldset>

          <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
            Provider placeholder (demo) — a assinatura ativa na hora, sem cobrança real ainda.
          </p>

          <label className="flex items-start gap-2 text-xs text-content-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" {...register('aceite_termos')} />
            <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
          </label>
          {errors.aceite_termos && (
            <p className="text-sm text-danger">{errors.aceite_termos.message}</p>
          )}

          {erro && (
            <p role="alert" className="text-sm text-danger">
              {erro}
            </p>
          )}

          <button type="submit" className="btn-brand w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta e assinar'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-content-2">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-brand">
            Entrar
          </Link>
        </p>

        <div className="mt-8 text-center">
          <PoweredByAX />
        </div>
      </div>
    </div>
  );
}
