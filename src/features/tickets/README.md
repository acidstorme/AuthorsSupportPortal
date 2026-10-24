# Tickets client feature

Author/admin clients provide ticket workflows, queue/triage/statuses/private history and attention. Conversation/detail/history poll every five seconds; lists every ten seconds while active. AIComposer requests a cached/new draft once on admin opening; refocus/polling do not generate. Admin edits survive arriving drafts, mock mode is labelled, regeneration is explicit and reviewed text is sent only through the message API. Retry IDs are retained until success for public messages and private notes. CLOSED blocks drafting/sending.
