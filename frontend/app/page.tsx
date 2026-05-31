import { CreateGroupForm } from '@/features/groups/components/create-group-form';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 gap-8">
      <h1 className="font-display text-7xl tracking-tighter">
        SPL<span className="text-red">AI</span>.
      </h1>
      <p className="font-editorial text-lg max-w-md text-center">
        URL を共有し、レシートを撮り、文字を流し込む。それ以外、何もしない。
      </p>
      <CreateGroupForm />
    </main>
  );
}
