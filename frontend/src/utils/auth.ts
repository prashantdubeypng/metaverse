interface UserData {
  id: string;
  username: string;
  email: string;
  role: 'User' | 'Admin';
}

interface TokenData {
  token: string;
  user: UserData;
}

export const getTokenData = (): TokenData | null => {
  if (typeof window === 'undefined') return null;
  try {
    const tokenData = localStorage.getItem('tokenData');
    if (!tokenData) return null;
    
    return JSON.parse(tokenData);
  } catch (error) {
    console.error('Error parsing token data:', error);
    return null;
  }
};

export const setTokenData = (data: TokenData): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem('tokenData', JSON.stringify(data));
};

export const clearTokenData = (): void => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('tokenData');
  localStorage.removeItem('token'); // Remove old token format if exists
};

export const isAuthenticated = (): boolean => {
  const tokenData = getTokenData();
  return tokenData !== null && tokenData.token !== '';
};

export const getUserRole = (): 'User' | 'Admin' | null => {
  const tokenData = getTokenData();
  return tokenData?.user?.role || null;
};

export const redirectBasedOnRole = (router: { push: (path: string) => void }): void => {
  const role = getUserRole();
  
  if (!isAuthenticated()) {
    router.push('/login');
    return;
  }
  
  if (role === 'Admin') {
    router.push('/admin');
  } else {
    router.push('/dashboard');
  }
};