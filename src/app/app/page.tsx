
'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, doc } from 'firebase/firestore';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2, Settings, History, SearchCheck, Loader2, LogOut } from 'lucide-react';
import { OptionsPage } from '@/components/options-page';
import { HistoryPage } from '@/components/history-page';
import { SearchListPage } from '@/components/search-list-page';
import { useCollection, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useAuthContext } from '@/firebase/auth/auth-provider';
import { type OnuData, type UserProfile, type FileInfo } from '@/lib/data';
import { Button } from '@/components/ui/button';

export default function AppPage() {
  const [activeView, setActiveView] = useState<'activas' | 'retiradas' | 'opciones' | 'historial' | 'en-busqueda'>('activas');
  
  const { user, profile, isAuthLoading, logout } = useAuthContext();
  const firestore = useFirestore();

  const onusCollectionRef = useMemoFirebase(() => collection(firestore, 'onus'), [firestore]);
  const { data: allOnus, isLoading: isOnusLoading } = useCollection<OnuData>(onusCollectionRef);

  const fileInfoDocRef = useMemoFirebase(() => doc(firestore, 'settings', 'fileInfo'), [firestore]);
  const { data: fileInfo, isLoading: isFileInfoLoading } = useDoc<FileInfo>(fileInfoDocRef);

  const { activeOnus, removedOnus, searchListOnus, allShelves } = useMemo(() => {
    if (!allOnus) {
      return { activeOnus: [], removedOnus: [], searchListOnus: [], allShelves: [] };
    }
    const active = allOnus.filter(onu => onu.status === 'active');
    const removed = allOnus.filter(onu => onu.status === 'removed');
    const search = profile ? allOnus.filter(onu => profile.searchList.includes(onu.id)) : [];
    const shelves = Array.from(new Set(active.map(onu => onu.Shelf))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return { activeOnus: active, removedOnus: removed, searchListOnus: search, allShelves: shelves };
  }, [allOnus, profile]);

  if (isAuthLoading || !user || !profile || isOnusLoading || isFileInfoLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }


  const renderActiveView = () => {
    switch (activeView) {
      case 'activas':
        return <OnuFinder 
                  activeView="activas" 
                  onus={activeOnus} 
                  searchList={profile.searchList}
                  allShelves={allShelves}
                  userId={user.uid}
                  fileInfo={fileInfo}
                />;
      case 'retiradas':
        return <OnuFinder 
                  activeView="retiradas" 
                  onus={removedOnus} 
                  searchList={profile.searchList}
                  allShelves={allShelves}
                  userId={user.uid}
                  fileInfo={fileInfo}
                />;
      case 'opciones':
        return <OptionsPage />;
      case 'historial':
        return <HistoryPage allOnus={allOnus || []} />;
      case 'en-busqueda':
        return <SearchListPage 
                  searchListOnus={searchListOnus}
                  searchListIds={profile.searchList}
                  userId={user.uid}
                />;
      default:
        return <OnuFinder 
                  activeView="activas" 
                  onus={activeOnus} 
                  searchList={profile.searchList}
                  allShelves={allShelves}
                  userId={user.uid}
                  fileInfo={fileInfo}
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
