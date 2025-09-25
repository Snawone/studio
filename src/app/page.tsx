'use client';

import { useState, useMemo, useEffect } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2, Settings, History, SearchCheck, Loader2 } from 'lucide-react';
import { OptionsPage } from '@/components/options-page';
import { HistoryPage } from '@/components/history-page';
import { SearchListPage } from '@/components/search-list-page';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase/provider';
import { type OnuData } from '@/lib/data';

export default function Home() {
  const [activeView, setActiveView] = useState<'activas' | 'retiradas' | 'opciones' | 'historial' | 'en-busqueda'>('activas');
  
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const onusCollectionRef = useMemoFirebase(
    () => user ? collection(firestore, 'users', user.uid, 'onus') : null,
    [firestore, user]
  );
  
  const { data: allOnus, isLoading: isOnusLoading } = useCollection<OnuData>(onusCollectionRef);

  const { activeOnus, removedOnus, searchList, allShelves } = useMemo(() => {
    if (!allOnus) {
      return { activeOnus: [], removedOnus: [], searchList: [], allShelves: [] };
    }
    const active = allOnus.filter(onu => onu.status === 'active');
    const removed = allOnus.filter(onu => onu.status === 'removed');
    const search = allOnus.filter(onu => onu.inSearch);
    const shelves = Array.from(new Set(active.map(onu => onu.Shelf))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    return { activeOnus: active, removedOnus: removed, searchList: search, allShelves: shelves };
  }, [allOnus]);

  if (isUserLoading || isOnusLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  const renderActiveView = () => {
    switch (activeView) {
      case 'activas':
        return <OnuFinder 
                  activeView="activas" 
                  onus={activeOnus} 
                  searchList={searchList}
                  allShelves={allShelves}
                  userId={user!.uid}
                />;
      case 'retiradas':
        return <OnuFinder 
                  activeView="retiradas" 
                  onus={removedOnus} 
                  searchList={searchList}
                  allShelves={allShelves}
                  userId={user!.uid}
                />;
      case 'opciones':
        return <OptionsPage />;
      case 'historial':
        return <HistoryPage allOnus={allOnus || []} />;
      case 'en-busqueda':
        return <SearchListPage 
                  searchList={searchList}
                  userId={user!.uid}
                />;
      default:
        return <OnuFinder 
                  activeView="activas" 
                  onus={activeOnus} 
                  searchList={searchList} 
                  allShelves={allShelves}
                  userId={user!.uid}
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
