
'use client';

import { useState } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';
import { Boxes, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [activeView, setActiveView] = useState<'activas' | 'retiradas'>('activas');

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
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="border-b md:hidden">
          <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Icons.logo className="h-7 w-7 text-primary" />
              <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">
                ONUs & SBTs
              </h1>
            </div>
            <SidebarTrigger asChild>
                <Button variant="ghost" size="icon" />
            </SidebarTrigger>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
            <OnuFinder activeView={activeView} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
