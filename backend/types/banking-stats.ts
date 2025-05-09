export type BankingStats = {
  lastUpdated: string;
  accountBalances: {
      current: number;
      monthlyBudget: number;
  };
  salaryInfo: {
      lastSalaryDate: string;
  };
  dailyTransactions: {
      count: number;
      debitCount: number;
      creditCount: number;
      pendingCount: number;
  };
  spending: {
      byCategory: {
          [key: string]: number;
      };
      monthly: {
          total: number;
          discretionary: number;
          nonDiscretionary: number;
          byExclusion: {
              [keyword: string]: number;
          };
          pendingTransactionsTotal: number;
      };
      totalCardSpent: number;
  };
};

export function initBankingStats(): BankingStats {
  const now = new Date().toISOString();
  return {
      lastUpdated: now,
      accountBalances: {
          current: 0,
          monthlyBudget: 0,
      },
      salaryInfo: {
          lastSalaryDate: '',
      },
      dailyTransactions: {
          count: 0,
          debitCount: 0,
          creditCount: 0,
          pendingCount: 0,
      },
      spending: {
          byCategory: {},
          monthly: {
              total: 0,
              discretionary: 0,
              nonDiscretionary: 0,
              byExclusion: {},
              pendingTransactionsTotal: 0,
          },
          totalCardSpent:0
      },
  };
}