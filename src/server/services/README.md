# Application services

Reserved boundary; no business services are implemented in Milestone 1.

Services will enforce role/ownership policies, lifecycle rules and database transactions. They accept a trusted principal from the server auth layer; never accept a user-supplied role or sender identity. Route Handlers delegate here. AI calls run outside database transactions.
