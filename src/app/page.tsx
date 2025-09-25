'use client';

import { useState, useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2, Settings, History, SearchCheck } from 'lucide-react';
import { OptionsPage } from '@/components/options-page';
import { HistoryPage } from '@/components/history-page';
import { SearchListPage } from '@/components/search-list-page';
import { type OnuData } from '@/lib/data';

export default function Home() {
  const [activeView, setActiveView] = useState<'activas' | 'retiradas' | 'opciones' | 'historial' | 'en-busqueda'>('activas');
  
  const [data, setData] = useState<OnuData[]>([]);
  const [removedOnus, setRemovedOnus] = useState<OnuData[]>([]);
  const [searchList, setSearchList] = useState<OnuData[]>([]);
  const [allOnus, setAllOnus] = useState<OnuData[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);


  const handleDataChange = (newData: OnuData[], newRemoved: OnuData[], newSearch: OnuData[]) => {
    setData(newData);
    setRemovedOnus(newRemoved);
    setSearchList(newSearch);
    const combined = [...newData, ...newRemoved];
    const uniqueOnus = Array.from(new Map(combined.map(onu => [onu['ONU ID'], onu])).values());
    setAllOnus(uniqueOnus);
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'activas':
      case 'retiradas':
        return <OnuFinder 
          activeView={activeView} 
          onDataChange={handleDataChange}
          initialData={data}
          initialRemovedOnus={removedOnus}
          initialSearchList={searchList}
          onDataLoaded={setIsDataLoaded}
        />;
      case 'opciones':
        return <OptionsPage />;
      case 'historial':
        return <HistoryPage allOnus={allOnus} />;
      case 'en-busqueda':
        return <SearchListPage 
                  searchList={searchList}
                  onDataChange={handleDataChange}
                  allActiveOnus={data}
                  allRemovedOnus={removedOnus}
                />;
      default:
        return <OnuFinder 
                  activeView="activas" 
                  onDataChange={handleDataChange} 
                  initialData={data}
                  initialRemovedOnus={removedOnus}
                  initialSearchList={searchList}
                  onDataLoaded={setIsDataLoaded}
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
              <SidebarMenuButton onClick={() => setActiveView('activas')} isActive={activeView === 'activas'} tooltip={{children: 'Activas'}}>
                <Boxes />
                Activas
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('retiradas')} isActive={activeView === 'retiradas'} tooltip={{children: 'Retiradas'}}>
                <Trash2 />
                Retiradas
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('en-busqueda')} isActive={activeView === 'en-busqueda'} tooltip={{children: 'En Búsqueda'}}>
                <SearchCheck />
                En Búsqueda
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setActiveView('historial')} isActive={activeView === 'historial'} tooltip={{children: 'Historial'}}>
                <History />
                Historial
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setActiveView('opciones')} isActive={activeView === 'opciones'} tooltip={{children: 'Opciones'}}>
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
