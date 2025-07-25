
'use client';

export default function AdminSchedulePage({ params }: { params: { boxId: string } }) {
  return (
    <div>
      <h1 className="text-2xl font-headline">Schedule for Box {params.boxId}</h1>
      <p>This is a placeholder page for the admin schedule.</p>
    </div>
  );
}

    