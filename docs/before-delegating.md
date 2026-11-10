# Worked example for a style check

The user asks, “Does the release-note writer also check whether it uses active voice?”
The writer produces the notes from a prompt. Editors already review the notes before publication.

Before writing a subagent brief, ask **Does a separate check need to exist?** The editors need
clear prose and already read the notes. A runtime gate has no separate owner to act on its
output. A false positive would delay publication and consume tokens on retries. The existing
writer prompt is where the style rule belongs.

A brief can give the subagent the outcome and room to choose the approach.

> Help the release-note writer produce active-voice prose. Trace where the notes are generated
> and check whether the existing prompt can address the issue. You can rule out a separate check
> if it has no reader or the prompt can solve the problem.
