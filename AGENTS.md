<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Profile photos are resized and square-cropped in the browser before updating `profiles.avatar`; this follows the existing database-backed image pattern and keeps uploads small without adding file storage infrastructure.

Toss Payments money flows (checkout confirm, refund on cancel/reject, completion settlement) run only in server functions in `src/lib/payments.functions.ts`; a database trigger blocks browser code from changing booking payment state, so amounts and refunds can't be tampered with client-side.
