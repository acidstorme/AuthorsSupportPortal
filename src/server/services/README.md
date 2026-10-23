# Application services

Auth, books and ticket services derive access from the verified principal, enforce ownership/roles, handle retry conflicts and serialize explicit DTOs. Admin services enforce ADMIN before queue/detail/history/mutations and permit only self-assignment or clearing. Atomic status/reply checks and mutations are repository transaction operations. AI remains deferred.

Services will enforce role/ownership policies, lifecycle rules and database transactions. They accept a trusted principal from the server auth layer; never accept a user-supplied role or sender identity. Route Handlers delegate here. AI calls run outside database transactions.
