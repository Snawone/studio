'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings, UserCog, ShieldCheck, Loader2 } from "lucide-react";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { type UserProfile } from '@/lib/data';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from '@/components/ui/switch';
import { setAdminClaim } from '@/ai/flows/set-admin-claim';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

function UserAdminRow({ user, currentUserProfile }: { user: UserProfile, currentUserProfile: UserProfile }) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [localIsAdmin, setLocalIsAdmin] = useState(user.isAdmin || false);

  const handleAdminChange = async (newIsAdmin: boolean) => {
    setIsUpdating(true);
    setLocalIsAdmin(newIsAdmin); // Optimistic update
    try {
      await setAdminClaim({ uid: user.id, isAdmin: newIsAdmin });
      toast({
        title: "Permisos actualizados",
        description: `${user.name} ahora ${newIsAdmin ? 'es' : 'no es'} administrador.`,
      });
    } catch (error) {
      console.error("Error updating admin status:", error);
      setLocalIsAdmin(!newIsAdmin); // Revert on error
      toast({
        variant: 'destructive',
        title: "Error",
        description: "No se pudieron actualizar los permisos.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const isCurrentUser = user.id === currentUserProfile.id;

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
           {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
           {isCurrentUser && <Badge variant="outline">Eres tú</Badge>}
          <Switch
            checked={localIsAdmin}
            onCheckedChange={handleAdminChange}
            disabled={isUpdating || isCurrentUser}
            aria-label={`Otorgar permisos de administrador a ${user.name}`}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}


export function OptionsPage() {
  const { profile } = useAuthContext();
  const firestore = useFirestore();
  const usersCollectionRef = useMemoFirebase(() => collection(firestore, 'users'), [firestore]);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollectionRef);

  const renderContent = () => {
    if (!profile) return null;

    if (!profile.isAdmin) {
       return (
         <Card>
           <CardHeader>
             <CardTitle>Sección en Desarrollo</CardTitle>
             <CardDescription>
               Este apartado está reservado para futuras opciones de configuración de la aplicación.
             </CardDescription>
           </CardHeader>
           <CardContent>
             <div className="text-center py-12 border-2 border-dashed rounded-lg">
               <p className="text-muted-foreground">
                 ¡Próximamente encontrarás nuevas funcionalidades aquí!
               </p>
             </div>
           </CardContent>
         </Card>
       );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCog /> Gestión de Administradores</CardTitle>
          <CardDescription>
            Otorga o revoca permisos de administrador a los usuarios del sistema. Los cambios pueden tardar unos minutos en aplicarse.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right flex items-center justify-end gap-2"><ShieldCheck className="h-4 w-4" /> Administrador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.sort((a,b) => a.name.localeCompare(b.name)).map(user => (
                    <UserAdminRow key={user.id} user={user} currentUserProfile={profile} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <section className="w-full max-w-4xl mx-auto flex flex-col gap-8">
        <div className="space-y-2">
            <h2 className="text-2xl font-headline font-semibold flex items-center gap-2">
                <Settings className="h-6 w-6"/>
                Opciones
            </h2>
            <p className="text-muted-foreground text-sm">
                Configuraciones y ajustes generales de la aplicación.
            </p>
        </div>
        {renderContent()}
    </section>
  );
}
