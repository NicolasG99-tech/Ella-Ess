import type {
  ComprehensionQuestionType,
  ExerciseType,
  IllustrationLayerName,
  LearningProfileCode,
  RewardType,
} from '@/generated/prisma/enums';

export interface StorySectionContent {
  order: number;
  text: string;
}

export interface IllustrationLayerContent {
  name: IllustrationLayerName;
  assetKey: string;
  renderOrder: number;
  unlockAfterSectionOrder: number;
}

export interface ComprehensionQuestionContent {
  order: number;
  type: ComprehensionQuestionType;
  prompt: string;
  options?: string[];
  correctAnswer: unknown;
  hintText?: string;
}

export interface StoryContent {
  slug: string;
  title: string;
  description: string;
  ageRange: string;
  difficultyLevel: 1 | 2 | 3;
  learningGoals: string[];
  sections: StorySectionContent[];
  illustrationLayers: IllustrationLayerContent[];
  comprehensionQuestions: ComprehensionQuestionContent[];
}

export interface ExerciseItemContent {
  order: number;
  prompt: string;
  solution: string;
  acceptedVariants?: string[];
  audioText?: string;
}

export interface ExerciseContent {
  type: ExerciseType;
  title: string;
  difficultyLevel: 1 | 2 | 3;
  learningProfileCode?: LearningProfileCode;
  items: ExerciseItemContent[];
}

export interface LiteracySkillContent {
  code: string;
  name: string;
  description: string;
  learningProfileCode: LearningProfileCode;
}

export interface RewardContent {
  code: string;
  type: RewardType;
  name: string;
  description: string;
  xpValue: number;
}
