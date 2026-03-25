Component({
  properties: {
    post: {
      type: Object,
      value: {}
    }
  },

  methods: {
    handleTap() {
      this.triggerEvent('tap', { postId: this.data.post.id });
    }
  }
});
