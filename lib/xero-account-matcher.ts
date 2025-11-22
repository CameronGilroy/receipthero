import { XeroAccount, AccountMatch } from './types';
import { openrouterClient } from './client';

export class AccountMatcher {
  private static readonly MAX_CONFIDENCE = 100;
  private static readonly MIN_CONFIDENCE_THRESHOLD = 20; // Minimum confidence to consider a match

  /**
   * Find the best matching Xero account for a receipt category using AI semantic matching
   */
  static async matchReceiptToAccount(
    receiptCategory: string,
    accounts: XeroAccount[],
    receiptDescription?: string
  ): Promise<AccountMatch> {
    if (!accounts || accounts.length === 0) {
      throw new Error('No Xero accounts available for matching');
    }

    try {
      // Prepare the account list for the AI
      const accountSummaries = accounts.map(account =>
        `- ${account.Code}: ${account.Name}${account.Description ? ` (${account.Description})` : ''} [${account.Type}]`
      ).join('\n');

      // Create the AI prompt
      const prompt = `You are an expert accountant specializing in expense categorization.

Given this receipt category and optional description:
Category: "${receiptCategory}"
${receiptDescription ? `Description: "${receiptDescription}"` : ''}

Please analyze this expense and match it to the most appropriate Xero account from the list below. Consider the semantic meaning, common accounting practices, and business expense categorization.

Available accounts:
${accountSummaries}

Return your response as a JSON object with this exact format:
{
  "matchedAccountCode": "XXX",
  "confidence": 85,
  "reasoning": "Brief explanation of why this account was chosen",
  "alternativeMatches": ["YYY", "ZZZ"]
}

Guidelines:
- Confidence should be 0-100 (100 being perfect match)
- Only include matchedAccountCode if confidence >= ${this.MIN_CONFIDENCE_THRESHOLD}
- Prioritize accounts where Type is "EXPENSE" for expense categorization
- Consider synonyms and related terms (e.g., "fuel" → "vehicle expenses", "meal" → "entertainment")
- alternativeMatches should be 1-3 other reasonable options`;

      // Call OpenRouter AI
      const response = await openrouterClient.chat.send({
        model: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for consistent results
        maxTokens: 500
      });

      const aiResponse = response?.choices?.[0]?.message?.content;
      if (!aiResponse || typeof aiResponse !== 'string') {
        throw new Error('No response from AI matching service');
      }

      // Parse the JSON response
      const matchResult = this.parseAIResponse(aiResponse);

      // Find the actual account objects
      const matchedAccount = accounts.find(acc => acc.Code === matchResult.matchedAccountCode);
      const alternativeAccounts = matchResult.alternativeMatches
        ?.map(code => accounts.find(acc => acc.Code === code))
        .filter(Boolean) as XeroAccount[];

      if (!matchedAccount) {
        throw new Error(`AI returned invalid account code: ${matchResult.matchedAccountCode}`);
      }

      return {
        xeroAccount: matchedAccount,
        confidence: matchResult.confidence,
        reasoning: matchResult.reasoning,
        alternatives: alternativeAccounts
      };

    } catch (error) {
      console.error('AI account matching failed:', error);

      // Fallback to simple keyword matching if AI fails
      return this.fallbackKeywordMatch(receiptCategory, accounts, receiptDescription);
    }
  }

  /**
   * Batch match multiple receipt categories to accounts
   */
  static async matchReceiptCategoriesToAccounts(
    receipts: Array<{ category: string; description?: string }>,
    accounts: XeroAccount[]
  ): Promise<AccountMatch[]> {
    const matches: AccountMatch[] = [];

    for (const receipt of receipts) {
      try {
        const match = await this.matchReceiptToAccount(
          receipt.category,
          accounts,
          receipt.description
        );
        matches.push(match);
      } catch (error) {
        console.error(`Failed to match category "${receipt.category}":`, error);

        // Return a low-confidence match from fallback
        const fallbackMatch = this.fallbackKeywordMatch(
          receipt.category,
          accounts,
          receipt.description
        );
        matches.push(fallbackMatch);
      }
    }

    return matches;
  }

  /**
   * Parse AI response and validate format
   */
  private static parseAIResponse(responseText: string): {
    matchedAccountCode: string;
    confidence: number;
    reasoning: string;
    alternativeMatches?: string[];
  } {
    try {
      // Extract JSON from response (AI might add extra text)
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No JSON found in AI response');
      }

      const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
      const parsed = JSON.parse(jsonString);

      // Validate required fields
      if (!parsed.matchedAccountCode || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid AI response format');
      }

      return {
        matchedAccountCode: parsed.matchedAccountCode,
        confidence: Math.max(0, Math.min(100, parsed.confidence)),
        reasoning: parsed.reasoning || 'AI-matched account',
        alternativeMatches: parsed.alternativeMatches || []
      };

    } catch (error) {
      console.error('Failed to parse AI response:', error, responseText);
      throw new Error('Invalid response format from AI matching service');
    }
  }

  /**
   * Fallback keyword-based matching when AI fails
   */
  private static fallbackKeywordMatch(
    receiptCategory: string,
    accounts: XeroAccount[],
    receiptDescription?: string
  ): AccountMatch {
    const categoryLower = receiptCategory.toLowerCase();
    const descriptionLower = receiptDescription?.toLowerCase() || '';

    const searchText = `${categoryLower} ${descriptionLower}`;

    // Find best keyword matches
    let bestMatch: XeroAccount | null = null;
    let bestScore = 0;

    for (const account of accounts) {
      let score = 0;

      const accountName = account.Name.toLowerCase();
      const accountCode = account.Code.toLowerCase();
      const accountDesc = account.Description?.toLowerCase() || '';

      // Exact matches get highest score
      if (accountName === categoryLower || accountCode === categoryLower) {
        score += 100;
      }

      // Partial word matches
      const words = searchText.split(/\s+/);
      for (const word of words) {
        if (word.length < 3) continue; // Skip short words

        if (accountName.includes(word)) score += 20;
        if (accountCode.includes(word)) score += 15;
        if (accountDesc.includes(word)) score += 10;
      }

      // Prioritize EXPENSE type accounts
      if (account.Type === 'EXPENSE') score += 5;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = account;
      }
    }

    if (!bestMatch) {
      // Ultimate fallback - first EXPENSE account
      bestMatch = accounts.find(acc => acc.Type === 'EXPENSE') || accounts[0];
      bestScore = 10; // Low confidence
    }

    return {
      xeroAccount: bestMatch!,
      confidence: Math.min(100, bestScore),
      reasoning: `Fallback keyword match (${searchText})`,
      alternatives: accounts.slice(1, 3) // First few alternatives
    };
  }

  /**
   * Get matching statistics for analysis
   */
  static getMatchStatistics(matches: AccountMatch[]): {
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    averageConfidence: number;
  } {
    const highConf = matches.filter(m => m.confidence >= 80).length;
    const mediumConf = matches.filter(m => m.confidence >= 50 && m.confidence < 80).length;
    const lowConf = matches.filter(m => m.confidence < 50).length;
    const avgConf = matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length;

    return {
      highConfidence: highConf,
      mediumConfidence: mediumConf,
      lowConfidence: lowConf,
      averageConfidence: Math.round(avgConf * 100) / 100
    };
  }

  /**
   * Filter accounts by type for more targeted matching
   */
  static filterAccountsByType(accounts: XeroAccount[], type: 'EXPENSE' | 'INCOME' | 'ALL' = 'EXPENSE'): XeroAccount[] {
    if (type === 'ALL') return accounts;
    return accounts.filter(account => account.Type === type);
  }

  /**
   * Improve accounts data by adding common synonyms and categories
   */
  static enrichAccountsWithMetadata(accounts: XeroAccount[]): XeroAccount[] {
    return accounts.map(account => ({
      ...account,
      // Add computed metadata for better matching
      _computed: {
        commonNames: this.generateCommonNames(account),
        categories: this.categorizeAccount(account)
      }
    })) as XeroAccount[];
  }

  /**
   * Generate common alternative names for an account
   */
  private static generateCommonNames(account: XeroAccount): string[] {
    const names: string[] = [account.Name.toLowerCase()];

    // Add common synonyms based on account name
    const synonymMap: Record<string, string[]> = {
      'motor vehicle': ['car', 'vehicle', 'fuel', 'gas', 'petrol'],
      'entertainment': ['meals', 'dining', 'restaurant', 'lunch', 'dinner'],
      'office supplies': ['supplies', 'stationery', 'equipment'],
      'repairs and maintenance': ['repairs', 'maintenance', 'fix'],
      'general expenses': ['miscellaneous', 'other', 'various'],
      'telephone': ['phone', 'mobile', 'cell', 'communication'],
      'internet': ['broadband', 'wifi', 'web'],
      'professional fees': ['consultant', 'advisor', 'expert'],
      'training': ['courses', 'education', 'learning'],
      'travel': ['flight', 'hotel', 'accommodation', 'transport']
    };

    for (const [key, synonyms] of Object.entries(synonymMap)) {
      if (account.Name.toLowerCase().includes(key)) {
        names.push(...synonyms);
      }
    }

    return [...new Set(names)]; // Remove duplicates
  }

  /**
   * Categorize account by common expense types
   */
  private static categorizeAccount(account: XeroAccount): string[] {
    const categories: string[] = [];
    const name = account.Name.toLowerCase();

    if (name.includes('meal') || name.includes('dining') || name.includes('restaurant')) categories.push('food');
    if (name.includes('fuel') || name.includes('vehicle') || name.includes('car')) categories.push('transport');
    if (name.includes('phone') || name.includes('internet') || name.includes('communication')) categories.push('utilities');
    if (name.includes('office') || name.includes('supplies') || name.includes('equipment')) categories.push('office');
    if (name.includes('travel') || name.includes('hotel') || name.includes('flight')) categories.push('travel');
    if (name.includes('training') || name.includes('course') || name.includes('education')) categories.push('training');
    if (name.includes('repair') || name.includes('maintenance')) categories.push('maintenance');

    return categories;
  }
}
