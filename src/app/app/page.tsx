
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2, Settings, History, SearchCheck, Loader2, LogOut, PackagePlus, Warehouse, Users } from 'lucide-react';
import { OptionsPage } from '@/components/options-page';
import { HistoryPage } from '@/components/history-page';
import { SearchListPage } from '@/components/search-list-page';
import { StockManagementPage } from '@/components/stock-management-page';
import { ShelvesManagementPage } from '@/components/shelves-management-page';
import { TechnicalGroupsPage } from '@/components/technical-groups-page';
import { useCollection, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { type OnuData, type UserProfile, type Shelf } from '@/lib/data';
import { Button } from '@/components/ui/button';

type ViewType = 'activas' | 'retiradas' | 'opciones' | 'historial' | 'en-busqueda' | 'cargar-stock' | 'estantes' | 'grupos-tecnicos';

export default function AppPage() {
  const [activeView, setActiveView] = useState<ViewType>('activas');
  
  const { user, profile, isAuthLoading, logout } = useAuthContext();
  const firestore = useFirestore();

  const onusCollectionRef = useMemoFirebase(() => query(collection(firestore, 'onus'), orderBy('addedDate', 'desc')), [firestore]);
  const { data: allOnus, isLoading: isOnusLoading } = useCollection<OnuData>(onusCollectionRef);
  
  const shelvesCollectionRef = useMemoFirebase(() => collection(firestore, 'shelves'), [firestore]);
  const { data: allShelves, isLoading: areShelvesLoading } = useCollection<Shelf>(shelvesCollectionRef);


  const searchListOnus = useMemo(() => {
    if (!profile || !allOnus || !profile.searchList) return [];
    return allOnus.filter(onu => profile.searchList.includes(onu.id));
  }, [allOnus, profile]);

  if (isAuthLoading || !user || !profile || areShelvesLoading) {
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
      shelves: allShelves || [],
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
      case 'estantes':
        return <ShelvesManagementPage />;
      case 'cargar-stock':
        return <StockManagementPage allOnus={allOnus || []} allShelves={allShelves || []} />;
       case 'grupos-tecnicos':
        return <TechnicalGroupsPage />;
      case 'opciones':
        return <OptionsPage allOnus={allOnus || []} allShelves={allShelves || []} />;
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
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('estantes')} isActive={activeView === 'estantes'} tooltip='Estantes'>
                    <Warehouse />
                    Estantes
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('cargar-stock')} isActive={activeView === 'cargar-stock'} tooltip='Gestion de stock'>
                    <PackagePlus />
                    Gestion de stock
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('grupos-tecnicos')} isActive={activeView === 'grupos-tecnicos'} tooltip='Grupos Técnicos'>
                    <Users />
                    Grupos Técnicos
                </SidebarMenuButton>
            </SidebarMenuItem>
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
