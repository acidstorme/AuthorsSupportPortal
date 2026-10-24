# Application services

Services enforce verified roles/ownership, retry safety, DTO serialization and AI orchestration. create-ticket-with-ai persists first and awaits one best-effort attempt without letting failure lose the ticket. AI services handle validation, scoped context, fingerprint/cache policy and explicit admin retry/regeneration. Provider calls run outside transactions. Admin drafting never sends a message; reviewed text uses the ordinary public-message service.

Services will enforce role/ownership policies, lifecycle rules and database transactions. They accept a trusted principal from the server auth layer; never accept a user-supplied role or sender identity. Route Handlers delegate here. AI calls run outside database transactions.
