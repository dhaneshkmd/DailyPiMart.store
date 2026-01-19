import { Button } from '@/components/ui/button';
import { usePiSDK } from '@/hooks/usePiSDK';
import { Loader2, LogIn } from 'lucide-react';

interface PiLoginButtonProps {
  onSuccess?: () => void;
  className?: string;
}

export function PiLoginButton({ onSuccess, className }: PiLoginButtonProps) {
  const {
    isReady,
    isAuthenticating,
    authenticate,
    isLoadingSession,
  } = usePiSDK();

  const handleLogin = async () => {
    if (!isReady || isAuthenticating) return;

    try {
      await authenticate();
      onSuccess?.();
    } catch (err) {
      // IMPORTANT:
      // Do NOT toast or block here — Pi Browser handles auth UX
      console.error('[Pi login failed]', err);
    }
  };

  const disabled = !isReady || isAuthenticating || isLoadingSession;

  return (
    <Button
      onClick={handleLogin}
      disabled={disabled}
      className={className}
      variant="default"
    >
      {isAuthenticating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in…
        </>
      ) : (
        <>
          <LogIn className="mr-2 h-4 w-4" />
          Sign in with Pi
        </>
      )}
    </Button>
  );
}
