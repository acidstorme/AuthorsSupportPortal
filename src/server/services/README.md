# Application services

Milestone 2 implements auth orchestration and scoped book reads. Ticket business services remain deferred.

Services will enforce role/ownership policies, lifecycle rules and database transactions. They accept a trusted principal from the server auth layer; never accept a user-supplied role or sender identity. Route Handlers delegate here. AI calls run outside database transactions.
