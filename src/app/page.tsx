'use client';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoginPage } from '@/components/login-page';
import { SignupPage } from '@/components/signup-page';
import { Icons } from '@/components/icons';

export default function AuthenticationPage() {
  const [activeTab, setActiveTab] = useState('login');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-4">
            <Icons.logo className="h-12 w-12 text-primary" />
            <h1 className="font-headline text-3xl font-bold tracking-tight text-foreground">
              ONUs & SBTs
            </h1>
            <p className="text-muted-foreground text-center">
              Tu herramienta para la gestión y búsqueda de equipos.
            </p>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
            <TabsTrigger value="signup">Registrarse</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <LoginPage />
          </TabsContent>
          <TabsContent value="signup">
            <SignupPage onSignupSuccess={() => setActiveTab('login')} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
