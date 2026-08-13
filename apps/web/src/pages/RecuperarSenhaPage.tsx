/** Recuperar senha (Supabase Auth): dispara o e-mail com o link de redefinição. */
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { PoweredByAX, Wordmark } from '../components/Wordmark';

const recuperarSchema = z.object({
  email: z.string().email('E-mail inválido'),
});
type RecuperarForm = z.infer<typeof recuperarSchema>;

export function RecuperarSenhaPage() {
  const { recuperarSenha } = useAuth();
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecuperarForm>({ resolver: zodResolver(recuperarSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setErro(null);
    try {
      await recuperarSenha(email);
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o e-mail');
    }
  });

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <Wordmark size="text-4xl" />
          </div>
          <p className="mt-2 text-base text-content-2">Recuperar acesso à sua conta</p>
        </div>

        {enviado ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-3xl">📩</p>
            <p className="font-display text-lg font-extrabold">Confira seu e-mail</p>
            <p className="text-sm text-content-2">
              Se existe uma conta com esse e-mail, enviamos um link para você criar uma nova senha.
              O link expira em pouco tempo.
            </p>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="card space-y-4 p-6" noValidate>
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

            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}

            <button type="submit" className="btn-brand w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-content-2">
          Lembrou a senha?{' '}
          <Link to="/login" className="font-medium text-brand">
            Voltar ao login
          </Link>
        </p>

        <div className="mt-8 text-center">
          <PoweredByAX />
        </div>
      </div>
    </div>
  );
}
