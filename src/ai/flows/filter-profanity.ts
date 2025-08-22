'use server';

/**
 * @fileOverview Implements profanity filtering using Genkit.
 *
 * - filterProfanity - A function that filters explicit content.
 * - FilterProfanityInput - The input type for the filterProfanity function.
 * - FilterProfanityOutput - The return type for the filterProfanity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FilterProfanityInputSchema = z.object({
  text: z
    .string()
    .describe("The text to filter for profanity and explicit content."),
});
export type FilterProfanityInput = z.infer<typeof FilterProfanityInputSchema>;

const FilterProfanityOutputSchema = z.object({
  filteredText: z
    .string()
    .describe("The filtered text with profanity and explicit content removed."),
});
export type FilterProfanityOutput = z.infer<typeof FilterProfanityOutputSchema>;

export async function filterProfanity(input: FilterProfanityInput): Promise<FilterProfanityOutput> {
  return filterProfanityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'filterProfanityPrompt',
  input: {schema: FilterProfanityInputSchema},
  output: {schema: FilterProfanityOutputSchema},
  prompt: `You are a content moderation AI responsible for filtering profanity and explicit language from user-generated text.  You must use reasoning to determine whether the content should be filtered.

  Here is the text to filter:
  {{text}}

  Return the filtered text. If the text does not contain profanity, return the original text.
  Even if a word is not directly a swear, you need to check if it is used in a profane context and filter it appropriately.
  If you are unsure, filter the word.
  `,
});

const filterProfanityFlow = ai.defineFlow(
  {
    name: 'filterProfanityFlow',
    inputSchema: FilterProfanityInputSchema,
    outputSchema: FilterProfanityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
