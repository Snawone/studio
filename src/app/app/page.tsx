
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2, Settings, History, SearchCheck, Loader2, LogOut, PackagePlus } from 'lucide-react';
import { OptionsPage } from '@/components/options-page';
import { HistoryPage } from '@/components/history-page';
import { SearchListPage } from '@/components/search-list-page';
import { StockManagementPage } from '@/components/stock-management-page';
import { useCollection, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { type OnuData, type UserProfile } from '@/lib/data';
import { Button } from '@/components/ui/button';

type ViewType = 'activas' | 'retiradas' | 'opciones' | 'historial' | 'en-busqueda' | 'cargar-stock';

export default function AppPage() {
  const [activeView, setActiveView] = useState<ViewType>('activas');
  
  const { user, profile, isAuthLoading, logout } = useAuthContext();
  const firestore = useFirestore();

  const onusCollectionRef = useMemoFirebase(() => query(collection(firestore, 'onus'), orderBy('addedDate', 'desc')), [firestore]);
  const { data: allOnus, isLoading: isOnusLoading } = useCollection<OnuData>(onusCollectionRef);

  const searchListOnus = useMemo(() => {
    if (!profile || !allOnus) return [];
    return allOnus.filter(onu => profile.searchList.includes(onu.id));
  }, [allOnus, profile]);

  if (isAuthLoading || !user || !profile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }


  const renderActiveView = () => {
    const commonProps = {
      onus: allOnus || [],
      searchList: profile.searchList || [],
      userId: user.uid,
      isLoadingOnus: isOnusLoading,
    };
    switch (activeView) {
      case 'activas':
        return <OnuFinder 
                  activeView="activas" 
                  {...commonProps}
                />;
      case 'retiradas':
        return <OnuFinder 
                  activeView="retiradas" 
                  {...commonProps}
                />;
      case 'cargar-stock':
        return <StockManagementPage />;
      case 'opciones':
        return <OptionsPage />;
      case 'historial':
        return <HistoryPage allOnus={allOnus || []} />;
      case 'en-busqueda':
        return <SearchListPage 
                  searchListOnus={searchListOnus}
                  searchListIds={profile.searchList || []}
                  userId={user.uid}
                />;
      default:
        return <OnuFinder 
                  activeView="activas" 
                  {...commonProps}
                />;
    }
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
           <div className="flex items-center gap-3 p-2">
            <Icons.logo className="h-7 w-7 text-primary" />
            <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">
              ONUs & SBTs
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('activas')} isActive={activeView === 'activas'} tooltip='Activas'>
                <Boxes />
                Activas
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('retiradas')} isActive={activeView === 'retiradas'} tooltip='Retiradas'>
                <Trash2 />
                Retiradas
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('en-busqueda')} isActive={activeView === 'en-busqueda'} tooltip='En Búsqueda'>
                <SearchCheck />
                En Búsqueda
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('historial')} isActive={activeView === 'historial'} tooltip='Historial'>
                <History />
                Historial
              </SidebarMenuButton>
            </SidebarMenuItem>
            {profile.isAdmin && (
              <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setActiveView('cargar-stock')} isActive={activeView === 'cargar-stock'} tooltip='Cargar Stock'>
                      <PackagePlus />
                      Cargar Stock
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('opciones')} isActive={activeView === 'opciones'} tooltip='Opciones'>
                    <Settings />
                    Opciones
                </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <Button variant="ghost" className="w-full justify-start gap-2" onClick={logout}>
                  <LogOut />
                  <span className="group-data-[collapsible=icon]:hidden">Cerrar Sesión</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="border-b md:hidden">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
               <SidebarTrigger>
                  <Icons.logo className="h-7 w-7 text-primary" />
               </SidebarTrigger>
              <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">
                ONUs & SBTs
              </h1>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
            {renderActiveView()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
