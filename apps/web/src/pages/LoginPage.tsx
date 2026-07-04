/** Login mobile-first (Supabase Auth via e-mail/senha). */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { entrar, session, carregando } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (!carregando && session) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ email, senha }) => {
    setErro(null);
    try {
      await entrar(email, senha);
      navigate('/', { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no login');
    }
  });

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="mb-8 text-center">
        <div className="text-3xl font-extrabold tracking-tight">
          <span className="text-brand">AX</span> Ads
        </div>
        <p className="mt-1 text-sm text-muted">Tráfego pago + automação + IA para e-commerce</p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4" noValidate>
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
            autoComplete="current-password"
            className="field"
            {...register('senha')}
          />
          {errors.senha && <p className="mt-1 text-sm text-danger">{errors.senha.message}</p>}
        </div>

        {erro && (
          <p role="alert" className="text-sm text-danger">
            {erro}
          </p>
        )}

        <button type="submit" className="btn-brand w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
