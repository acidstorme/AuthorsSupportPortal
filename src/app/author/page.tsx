import { requirePageRole } from "@/server/auth/current-user";
import { listBooks } from "@/server/services/books";
import { booksRepository } from "@/server/repositories/books";
import { LogoutButton } from "@/components/auth/logout-button";
import { AuthorTickets } from "@/features/tickets/client";

export default async function AuthorPage() {
  const principal = await requirePageRole("AUTHOR");
  const books = await listBooks(principal, { page: 1, pageSize: 100, sort: "title_asc" }, booksRepository);
  return <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">BookLeaf · Author</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {principal.displayName}</h1><p className="mt-2 text-muted-foreground">{principal.email} · {principal.role} · {principal.authorId}</p></div><LogoutButton /></header>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Your books <span className="text-muted-foreground">({books.meta.total})</span></h2>
      <ul className="grid gap-4 sm:grid-cols-2">{books.data.map((book) => <li key={book.bookId} className="space-y-2 rounded-lg border border-border p-5"><p className="text-xs text-muted-foreground">{book.bookId}</p><h3 className="font-semibold">{book.title}</h3><p className="text-sm text-muted-foreground">{book.status}</p><p className="text-sm">ISBN: {book.isbn}</p><p className="text-sm">Publication date: {book.publicationDate ?? "Not yet available"}</p></li>)}</ul>
      <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer font-medium">Book and royalty details</summary><div className="mt-4 space-y-6">{books.data.map((book) => <section className="space-y-2" key={book.bookId}><h3 className="font-semibold">{book.title}</h3><dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries({ Genre: book.genre, "MRP (INR)": book.mrp, "Royalty per copy (INR)": book.authorRoyaltyPerCopy, "Copies sold": book.totalCopiesSold, "Royalty earned (INR)": book.totalRoyaltyEarned, "Royalty paid (INR)": book.royaltyPaid, "Royalty pending (INR)": book.royaltyPending, "Last payout date": book.lastRoyaltyPayoutDate, "Print partner": book.printPartner, "Available on": book.availableOn.join(", ") || null }).map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd>{value ?? "Not available"}</dd></div>)}</dl></section>)}</div><p className="mt-4 text-xs text-muted-foreground">These supplied financial snapshots are not a live accounting statement.</p></details>
      {books.meta.total === 0 && <p>No books are linked to your profile. Contact the demo administrator.</p>}
    </section>
    <AuthorTickets />
  </main>;
}
