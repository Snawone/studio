import { OnuFinder } from '@/components/onu-finder';
import { Icons } from '@/components/icons';

export default function Home() {
  return (
    <div className="min-h-screen w-full">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Icons.logo className="h-7 w-7 text-primary" />
            <h1 className="font-headline text-xl font-bold tracking-tight text-foreground">
              OnuShelf Finder
            </h1>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8 md:px-6 md:py-12">
        <OnuFinder />
      </main>
    </div>
  );
}
