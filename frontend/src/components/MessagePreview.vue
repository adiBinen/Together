<template>
  <li class="msg-preview" :title="(chat.trip && chattingWith.length)? chat.trip.title: chattingWith[0].firstname">
    <div class="user-img-container">
      <div
        class="user-img"
        v-for="(pic) in profilePics"
        :key="pic"
        :style="{'background-image': `url(${pic})`}"
      />
    </div>
    <div
      class="msg-content"
    >
      <h4 v-if="chattingWith.length && !chat.trip">{{`${chattingWith[0].firstname} ${chattingWith[0].lastname}`}}</h4>
      <h4 v-else>{{chat.trip.title}}</h4>
      <div v-if="lastMsg">{{lastSender}}&nbsp;{{lastMsg.txt}}</div>
    </div>
    <span v-if="lastMsg" class="sent-at">
      {{lastMsg.sentAt | fromNow}}
    </span>
  </li>
</template>

<script>
export default {
  props: {
    chat: {
      type: Object,
      required: true
    },
    user: {
        type: Object,
        required: true,
    }
  },
  computed: {
    chattingWith() {
      return this.chat.users.filter(otherUser => otherUser._id !== this.user._id);
    },
    profilePics() {
      return this.chattingWith.map(user => user.profilePic).slice(0,3);
    },
    lastMsg() {
      if (!this.filteredChat.length) return '';
      return this.filteredChat[this.filteredChat.length - 1];
    },
    lastSender() {
      if (!this.lastMsg && !this.lastMsg.sender) return '';
      const senderId = this.lastMsg.sender;
      if (senderId === this.user._id) return 'You:';
      else if(this.chattingWith.length)  {
        const sender = this.chattingWith.find(user => user._id === senderId);
        return (sender)? sender.firstname + ':': '';
      }
      else return '';
      
    },
    filteredChat() {
      return this.chat.msgs.filter(msg => msg.sender && msg.txt)
    }
  }
};
</script>

<style>
</style>
