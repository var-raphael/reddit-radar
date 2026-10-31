# Evaluation report
Model: openai-compatible:ministral-14b-latest | Date: 2026-10-31 | Posts: 58 (0 failed to parse)
Sample: random, capped per subreddit, answer key drafted by Claude and reviewed by me. Not a population estimate.

## Filter (relevant vs not)
| | Model kept | Model dropped |
|---|---|---|
| Human kept | 14 | 1 |
| Human dropped | 8 | 35 |

Accuracy 84.5% | Precision 63.6% (kept posts that are truly relevant) | Recall 93.3% (relevant posts the model kept)

## Labels on posts both kept (n=14)
Category agreement 78.6% | Urgency exact 78.6%, within 1: 100.0%, mean abs error 0.21

## Tokens (all 58 posts)
Input 42335, output 3623 | Per post: 730 in, 62 out | Per 1,000 posts: 0.730M in, 0.062M out

## Where the filter disagreed with me
- [I dropped, model kept] r/Notion: I built a free Notion idea vault for creators because my notes app was where ideas went t…
  model said: The post is about leveraging Notion for a specific use case (idea vault for creators), which is directly related to Notion’s product and its utility for users.
- [I kept, model dropped] r/Notion: bdr interview at notion
  model said: Post is about job interview preparation for Notion, not a discussion of the product, its features, or comparisons with alternatives.
- [I dropped, model kept] r/Notiontemplates: HabitHeroes - Notion PVP Habit Tracking made social
  model said: The post introduces a Notion-integrated habit-tracking tool with social features, directly enhancing Notion's ecosystem and user engagement.
- [I dropped, model kept] r/Notiontemplates: Free Book Notes Template
  model said: The post showcases a creative use of Notion for a specific purpose (book tracking) and shares a free template, indirectly promoting Notion’s flexibility and ut…
- [I dropped, model kept] r/productivity: I've abandoned about 25 to-do tools since 2003. Here's what I took from it.
  model said: The post discusses past experiences with productivity tools, including Notion, and asks for recommendations on managing tasks effectively, implying a compariso…
- [I dropped, model kept] r/productivity: I do a lot, but it's complete chaos - looking for tips
  model said: User is explicitly asking for recommendations on tools (including Notion) to organize their work and projects, comparing alternatives to their current chaotic …
- [I dropped, model kept] r/productivity: I just worked for 7 hours and got nothing done.
  model said: The post discusses using Notion (database/calendar) as part of a productivity workflow, suggesting a feature or workflow improvement for task management.
- [I dropped, model kept] r/Airtable: Airtable comments - how are you working around this garbage?
  model said: User is actively considering switching from Airtable due to dissatisfaction with its comment system, which is a direct comparison to Notion's capabilities.
- [I dropped, model kept] r/PKMS: Why I stopped using ChatGPT for serious research (and what happened when I moved 70+ tech…
  model said: The post discusses a user's positive experience switching from ChatGPT to Google NotebookLM (a Notion-related tool) for research, highlighting its advantages o…

## Where the category disagreed
- r/Notion: How are you using Notion to get better answers from Claude or ChatGPT? (me: other, model: product idea)
- r/Notion: File-based Notion alternative (me: product idea, model: asking for a recommendation)
- r/Notion: Can I change the display format of a formula date without converting it to text? (me: other, model: bug report)
