import { requirePageRole } from "@/server/auth/current-user";
import { listBooks } from "@/server/services/books";
import { booksRepository } from "@/server/repositories/books";
import { Brand } from "@/components/brand";
import { LogoutButton } from "@/components/auth/logout-button";
import { AuthorTickets } from "@/features/tickets/client";

export default async function AuthorPage() {
  const principal = await requirePageRole("AUTHOR");
  const books = await listBooks(principal, { page: 1, pageSize: 100, sort: "title_asc" }, booksRepository);
  return <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
    <div className="flex items-center justify-between gap-4"><Brand href="/author" /><LogoutButton /></div><header className="portal-header flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-primary">BookLeaf · Author</p><h1 className="mt-2 text-3xl font-semibold">Welcome, {principal.displayName}</h1><p className="mt-2 text-muted-foreground">Your books, conversations, and publishing support — all together.</p></div></header>
    <section className="space-y-4"><h2 className="text-xl font-semibold">Your books <span className="text-muted-foreground">({books.meta.total})</span></h2>
      <ul className="grid gap-4 sm:grid-cols-2">{books.data.map((book) => <li key={book.bookId} className="surface space-y-2 border-t-[3px] border-t-[#f6637b] p-6"><p className="text-xs text-muted-foreground">{book.bookId}</p><h3 className="font-semibold">{book.title}</h3><p className="text-sm text-muted-foreground">{book.status}</p><p className="text-sm">ISBN: {book.isbn}</p><p className="text-sm">Publication date: {book.publicationDate ?? "Not yet available"}</p></li>)}</ul>
      <details className="surface p-5 sm:p-6">
        <summary className="cursor-pointer rounded-sm text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">Book and royalty details</summary>
        <div className="mt-6 space-y-8">
          {books.data.map((book) => <section aria-labelledby={`royalty-heading-${book.bookId}`} className="overflow-hidden rounded-xl border border-border bg-background/50 shadow-sm" key={book.bookId}>
            <header className="border-b border-border border-l-4 border-l-[#f6637b] bg-muted px-5 py-5 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Book details · {book.bookId}</p>
              <h3 id={`royalty-heading-${book.bookId}`} className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">{book.title}</h3>
            </header>
            <dl className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
              {Object.entries({ Genre: book.genre, "MRP (INR)": book.mrp, "Royalty per copy (INR)": book.authorRoyaltyPerCopy, "Copies sold": book.totalCopiesSold, "Royalty earned (INR)": book.totalRoyaltyEarned, "Royalty paid (INR)": book.royaltyPaid, "Royalty pending (INR)": book.royaltyPending, "Last payout date": book.lastRoyaltyPayoutDate, "Print partner": book.printPartner, "Available on": book.availableOn.join(", ") || null }).map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-border bg-white p-5 shadow-sm">
                <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
                <dd className="mt-3 break-words text-2xl font-semibold leading-snug tracking-tight tabular-nums">{value ?? "Not available"}</dd>
              </div>)}
            </dl>
          </section>)}
        </div>
        <p className="mt-5 text-xs text-muted-foreground">These supplied financial snapshots are not a live accounting statement.</p>
      </details>
      {books.meta.total === 0 && <p>No books are linked to your profile. Contact the demo administrator.</p>}
    </section>
    <AuthorTickets />
  </main>;
}
