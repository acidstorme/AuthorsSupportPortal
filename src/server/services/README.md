# Application services

Auth, scoped books and ticket services derive access from the verified principal, enforce ownership and creation policies, handle creation retry conflicts and serialize explicit public DTOs. Atomic reply status checks/deduplication are repository transaction operations. Admin management and AI remain deferred.

Services will enforce role/ownership policies, lifecycle rules and database transactions. They accept a trusted principal from the server auth layer; never accept a user-supplied role or sender identity. Route Handlers delegate here. AI calls run outside database transactions.
