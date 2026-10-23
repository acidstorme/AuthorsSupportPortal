# Tickets client feature

Author clients provide creation, lists and public conversations. Admin clients provide queue/filtering, manual triage, self-assignment, explicit statuses/reopening, private notes/history and resolved-reply attention. Conversation/detail/history poll every five seconds; lists every ten seconds while active. Request IDs survive unchanged-content message/note retries and reset on success. No AI generation runs on render, refocus or polling. Drafts remain Milestone 5.
