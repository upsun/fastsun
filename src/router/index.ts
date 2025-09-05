import AppLayout from '@/layout/AppLayout.vue';
import { createRouter, createWebHistory } from 'vue-router';
import { installSecurityMiddleware } from '@/utils/securityMiddleware';

/**
 * Global router of App.
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/views/HomeView.vue'),
          children: [
            {
              path: 'acl/$id',
              name: 'Acl edit',
              component: () => import('@/views/HomeView.vue'),
            },
          ],
        },
      ],
    },
    // {
    //   path: '/about',
    //   name: 'about',
    //   component: () => import('@/views/AboutView.vue'),
    // },
  ],
});

// Install security middleware
installSecurityMiddleware(router, {
  enableRateLimit: true,
  enableParameterValidation: true,
  logSuspiciousActivity: true,
});

export default router;
