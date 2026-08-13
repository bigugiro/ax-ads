/**
 * Redefinir senha (Supabase Auth): destino do link enviado por e-mail.
 * O cliente Supabase (`detectSessionInUrl`) troca o token da URL por uma sessão
 * de recovery; com ela, `updateUser` grava a nova senha e o usuário já entra.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { PoweredByAX, Wordmark } from '../components/Wordmark';

const redefinirSchema = z
  .object({
    senha: z.string().min(6, 'Mínimo 6 caracteres'),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    message: 'As senhas não conferem',
    path: ['confirmar'],
  });
type RedefinirForm = z.infer<typeof redefinirSchema>;

export function RedefinirSenhaPage() {
  const { session, carregando, redefinirSenha } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  // O token da URL é processado de forma assíncrona: dá uma janela de graça
  // antes de concluir que o link é inválido (evita "flash" de erro).
  const [expirouGraca, setExpirouGraca] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setExpirouGraca(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RedefinirForm>({ resolver: zodResolver(redefinirSchema) });

  const onSubmit = handleSubmit(async ({ senha }) => {
    setErro(null);
    try {
      await redefinirSenha(senha);
      navigate('/', { replace: true });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível redefinir a senha');
    }
  });

  const verificando = carregando || (!session && !expirouGraca);

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <Wordmark size="text-4xl" />
          </div>
          <p className="mt-2 text-base text-content-2">Defina uma nova senha</p>
        </div>

        {verificando ? (
          <div className="card p-6 text-center text-sm text-muted" role="status">
            Verificando o link…
          </div>
        ) : !session ? (
          <div className="card space-y-3 p-6 text-center">
            <p className="text-3xl">⚠️</p>
            <p className="font-display text-lg font-extrabold">Link inválido ou expirado</p>
            <p className="text-sm text-content-2">
              O link de redefinição não é mais válido. Solicite um novo para continuar.
            </p>
            <Link to="/recuperar-senha" className="btn-brand w-full">
              Solicitar novo link
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="card space-y-4 p-6" noValidate>
            <div>
              <label htmlFor="senha" className="mb-1 block text-sm font-medium">
                Nova senha
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

            <div>
              <label htmlFor="confirmar" className="mb-1 block text-sm font-medium">
                Confirmar nova senha
              </label>
              <input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                className="field"
                {...register('confirmar')}
              />
              {errors.confirmar && (
                <p className="mt-1 text-sm text-danger">{errors.confirmar.message}</p>
              )}
            </div>

            {erro && (
              <p role="alert" className="text-sm text-danger">
                {erro}
              </p>
            )}

            <button type="submit" className="btn-brand w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <div className="mt-8 text-center">
          <PoweredByAX />
        </div>
      </div>
    </div>
  );
}
