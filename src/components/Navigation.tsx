import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  User,
  Home,
  Grid3X3,
  ShoppingBag,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePiSDK } from '@/hooks/usePiSDK';
import { useCartStore } from '@/store/cartStore';

export function Navigation() {
  const location = useLocation();
  const {
    user,
    isAuthenticated,
    authenticate,
    logout,
    isAuthenticating,
  } = usePiSDK();

  const { getTotalItems } = useCartStore();
  const totalItems = getTotalItems();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-pi rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">π</span>
            </div>
            <span className="font-bold text-xl bg-gradient-pi bg-clip-text text-transparent">
              Daily Pi Mart
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-1">
            <Button variant={isActive('/') ? 'default' : 'ghost'} size="sm" asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>

            <Button
              variant={isActive('/browse') ? 'default' : 'ghost'}
              size="sm"
              asChild
            >
              <Link to="/browse">
                <Grid3X3 className="mr-2 h-4 w-4" />
                Browse
              </Link>
            </Button>

            {isAuthenticated && (
              <Button
                variant={isActive('/orders') ? 'default' : 'ghost'}
                size="sm"
                asChild
              >
                <Link to="/orders">
                  <ShoppingBag className="mr-2 h-4 w-4" />
                  Orders
                </Link>
              </Button>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
            {/* Cart */}
            <Button
              variant={isActive('/cart') ? 'default' : 'ghost'}
              size="sm"
              className="relative"
              asChild
            >
              <Link to="/cart">
                <ShoppingCart className="h-4 w-4" />
                {totalItems > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {totalItems > 9 ? '9+' : totalItems}
                  </Badge>
                )}
              </Link>
            </Button>

            {/* Auth */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{user.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link to="/account">Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders">Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                size="sm"
                onClick={authenticate}
                disabled={isAuthenticating}
                className="gap-2"
              >
                {isAuthenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in with Pi'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
