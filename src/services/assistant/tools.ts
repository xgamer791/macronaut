/** OpenAI/xAI chat-completions tool definitions for the Macronaut voice agent. */

export type AssistantToolDef = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

const dateProp = {
  type: 'string',
  description:
    'Day as YYYY-MM-DD, or relative: today, yesterday, tomorrow, N days ago, last monday, etc. Defaults to today.',
};

export const ASSISTANT_TOOLS: AssistantToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'get_day_summary',
      description:
        'Get calories, macros, burned exercise, remaining calories, and goals for a day. Use for any historical day (e.g. 4 days ago).',
      parameters: {
        type: 'object',
        properties: { date: dateProp },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_diary_entries',
      description: 'List foods logged on a day (name, meal, calories, macros, ids).',
      parameters: {
        type: 'object',
        properties: { date: dateProp },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_meal',
      description:
        'Log a food/meal into the diary. Use when the user asks to add, log, or track food. Estimate nutrition if they only give a name.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Food name' },
          calories: { type: 'number', description: 'Total calories for the portion' },
          protein: { type: 'number', description: 'Protein grams' },
          carbs: { type: 'number', description: 'Carb grams' },
          fat: { type: 'number', description: 'Fat grams' },
          fiber: { type: 'number', description: 'Fiber grams' },
          meal: {
            type: 'string',
            description: 'Meal slot id: breakfast, lunch, dinner, or snacks',
            enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
          },
          date: dateProp,
          notes: { type: 'string', description: 'Optional entry notes' },
          serving_desc: { type: 'string', description: 'Optional portion description' },
        },
        required: ['name', 'calories'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_diary_entry',
      description: 'Update a logged food by id (name, calories, macros, meal, notes).',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          meal: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snacks'] },
          notes: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_diary_entries',
      description: 'Delete one or more diary food entries by id.',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['ids'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_notes',
      description: 'List day notes for a specific date (id, body, date).',
      parameters: {
        type: 'object',
        properties: { date: dateProp },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_notes',
      description:
        'Search notes across a date range (default last 30 days). Use to find notes from last week or by keyword.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional text to match in note body (case-insensitive)',
          },
          from: dateProp,
          to: dateProp,
          days_back: {
            type: 'number',
            description: 'If from/to omitted, search this many days back from today (default 30)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_note',
      description:
        'Create a day note. When the user says "make a note of that" or "add that to my notes", use your previous spoken answer as the body unless they give new text.',
      parameters: {
        type: 'object',
        properties: {
          body: { type: 'string', description: 'Full note text to save' },
          date: dateProp,
        },
        required: ['body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_note',
      description: 'Update an existing note body by id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['id', 'body'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_note',
      description: 'Delete a note by id. Call find_notes or list_notes first if you need the id.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_activities',
      description: 'List exercise/activity entries for a day (burned calories, duration, ids).',
      parameters: {
        type: 'object',
        properties: { date: dateProp },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_activity',
      description: 'Log exercise / activity that burns calories.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          calories_burned: { type: 'number' },
          activity_type: {
            type: 'string',
            enum: ['cardio', 'strength', 'sports', 'mobility', 'other'],
          },
          duration_min: { type: 'number' },
          intensity: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
          date: dateProp,
          notes: { type: 'string' },
        },
        required: ['name', 'calories_burned'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_activity',
      description: 'Delete an activity entry by id.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_recent_foods',
      description: 'List recently logged foods the user often picks.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max items (default 10)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_goals',
      description: 'Get calorie/macro targets for a day.',
      parameters: {
        type: 'object',
        properties: { date: dateProp },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remember_fact',
      description:
        'Pin a short fact to long-term assistant memory (preferences, reminders). Use sparingly.',
      parameters: {
        type: 'object',
        properties: {
          fact: { type: 'string', description: 'One short factual sentence to remember' },
        },
        required: ['fact'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'recall_memory',
      description: 'Recall pinned facts and recent conversation turns from assistant memory.',
      parameters: { type: 'object', properties: {} },
    },
  },
];
