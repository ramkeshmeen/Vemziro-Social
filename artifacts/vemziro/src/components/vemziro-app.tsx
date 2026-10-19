import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ClerkProvider, SignIn, SignUp, UserButton, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, AtSign, Camera, Check, CircleAlert,
  Compass, Film, Heart, ImagePlus, LoaderCircle, MessageCircle, MoreHorizontal, Plus, Send,
  Sparkles, UserRoundPlus, Users, X,
} from 'lucide-react';
import {
  getGetCommentsQueryKey, getGetFeedQueryKey, getGetMyProfileQueryKey, getGetProfileQueryKey,
  getGetProfileSuggestionsQueryKey, getGetStorageObjectQueryKey, getHealthCheckQueryKey,
  useCreateComment, useCreatePost, useGetComments, useGetFeed, useGetMyProfile,
  useGetProfile, useGetProfileSuggestions, useGetStorageObject, useHealthCheck,
  useRequestUploadUrl, useToggleFollow, useToggleLike, useUpdateMyProfile,
} from '@workspace/api-client-react';
import type { Comment, Post, Profile, ProfileSummary } from '@workspace/api-client-react';

const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const signInPath = `${basePath}/sign-in`;
const signUpPath = `${basePath}/sign-up`;

function Avatar({ profile, size = 'md' }: { profile?: ProfileSummary | null; size?: 'sm' | 'md' | 'lg' }) {
  const initials = (profile?.displayName || profile?.username || 'V').slice(0, 1).toUpperCase();
  return (
    <div className={`avatar avatar-${size}`} data-testid={`img-avatar-${profile?.username || 'fallback'}`}>
      {profile?.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{initials}</span>}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <Link href="/" className="brand" data-testid="link-home"><span className="brand-mark">v.</span>{!compact && <span>vemziro</span>}</Link>;
}

function AppRoot() {
  if (!key) return <MissingClerk />;
  return (
    <ClerkProvider publishableKey={key} signInUrl={signInPath} signUpUrl={signUpPath} appearance={{
      variables: {
        colorPrimary: '#f1a65e', colorBackground: '#191b24', colorForeground: '#f3efe8',
        borderRadius: '14px', fontFamily: 'Manrope, sans-serif',
      },
      elements: {
        card: 'clerk-card', headerTitle: 'clerk-title', formButtonPrimary: 'clerk-primary',
        footerActionLink: 'clerk-link', formFieldInput: 'clerk-input',
      },
    }}>
      <AppContent />
    </ClerkProvider>
  );
}

function MissingClerk() {
  return <main className="min-h-[100dvh] flex items-center justify-center p-6 app-shell text-[#f3efe8]">
    <div className="max-w-md text-center">
      <Brand />
      <h1 className="display-title mt-12">Your people are<br />almost here.</h1>
      <p className="mt-4 text-sm text-[#a4a5ad]">Clerk authentication needs a publishable key. Add <code>VITE_CLERK_PUBLISHABLE_KEY</code> to enable member accounts.</p>
    </div>
  </main>;
}

function AppContent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const isAuth = location.startsWith('/sign-in') || location.startsWith('/sign-up');

  useEffect(() => {
    if (!isLoaded) return;
    queryClient.removeQueries({
      predicate: (query) => {
        const first = String(query.queryKey[0] || '');
        return first.includes('/api/me/profile') || first.includes('/api/feed') || first.includes('/api/profiles/');
      },
    });
  }, [user?.id, isLoaded, queryClient]);

  return (
    <div className="app-shell grain min-h-[100dvh]">
      {isAuth ? <AuthRoutes /> : !isLoaded ? <div className="loading-screen"><div className="loading-brand"><Brand /><div className="load-bar" /></div></div> : isSignedIn ? <MemberApp /> : <PublicRoutes />}
    </div>
  );
}

function AuthRoutes() {
  return <div className="auth-layout">
    <aside className="auth-art">
      <Brand />
      <div className="auth-orbit"><span className="orbit-dot" /><span className="orbit-line" /><span className="orbit-caption">your corner<br />of the internet</span></div>
      <div className="auth-note"><span className="eyebrow">A LITTLE MORE HUMAN</span><p>Life looks better<br />when it’s shared.</p></div>
    </aside>
    <main className="auth-form-area">
      <Switch>
        <Route path="/sign-in"><SignIn routing="path" path={signInPath} signUpUrl={signUpPath} /></Route>
        <Route path="/sign-in/:rest*"><SignIn routing="path" path={signInPath} signUpUrl={signUpPath} /></Route>
        <Route path="/sign-up"><SignUp routing="path" path={signUpPath} signInUrl={signInPath} /></Route>
        <Route path="/sign-up/:rest*"><SignUp routing="path" path={signUpPath} signInUrl={signInPath} /></Route>
      </Switch>
      <Link href="/" className="back-home" data-testid="link-back-home"><ArrowLeft size={15} /> Back to Vemziro</Link>
    </main>
  </div>;
}

function PublicRoutes() {
  return <Switch>
    <Route path="/"><Welcome /></Route>
    <Route component={NotFound} />
  </Switch>;
}

function Welcome() {
  return <div className="welcome">
    <header className="welcome-nav"><Brand /><nav><a href="#why">The feeling</a><a href="#moments">Moments</a></nav><div className="welcome-actions">
      <Link href={signInPath} className="nav-signin" data-testid="link-sign-in">Sign in</Link>
      <Link href={signUpPath} className="button-primary small" data-testid="link-sign-up">Join Vemziro <ArrowRight size={15} /></Link>
    </div></header>
    <main>
      <section className="welcome-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="live-dot" /> YOUR PEOPLE. YOUR PERSPECTIVE.</span>
          <h1 className="display-title">A place for<br /><em>the in-between.</em></h1>
          <p>The tiny moments, the big nights, the things you almost didn’t post. Keep your circle close and your camera roll moving.</p>
          <Link href={signUpPath} className="button-primary hero-cta" data-testid="button-join-community">Find your people <ArrowRight size={17} /></Link>
          <div className="hero-social-proof"><div className="mini-avatars"><span>J</span><span>M</span><span>A</span><span>+</span></div><span>Good things are happening<br /><b>in your circle.</b></span></div>
        </div>
        <div className="hero-art" aria-label="A photo collage preview">
          <div className="hero-image hero-photo-one"><div className="photo-grain" /><span className="image-caption">somewhere, slowly</span></div>
          <div className="hero-image hero-photo-two"><div className="photo-grain" /></div>
          <div className="hero-image hero-photo-three"><div className="photo-grain" /></div>
          <div className="photo-stamp"><span>VZ / 01</span><i>+</i><span>KEEP THE GOOD STUFF</span></div>
          <div className="hero-doodle">a little<br />closer <ArrowDownRight size={20} /></div>
        </div>
        <div className="hero-side-label">SCROLL TO FEEL SOMETHING — 01 / 04</div>
      </section>
      <section className="welcome-manifesto" id="why">
        <div className="manifesto-index">01 <span>— WHY WE’RE HERE</span></div>
        <h2>Not a highlight reel.<br /><span>A life reel.</span></h2>
        <div className="manifesto-foot"><p>Less performing. More remembering. Vemziro is for the everyday texture of being you, with the people who get it.</p><span className="handwritten">that’s the whole point.</span></div>
      </section>
      <section className="moments-section" id="moments">
        <div className="section-intro"><span className="eyebrow">02 — MADE FOR THE MOMENTS</span><h2>Nothing polished.<br /><em>Everything yours.</em></h2></div>
        <div className="moment-grid">
          <article className="moment-tile tile-wide"><div className="moment-art art-sunset"><span className="tile-note">05:42 PM<br />golden hour, obviously</span></div><div className="tile-caption"><span>01 / KEEP IT REAL</span><p>Post what you actually see.</p></div></article>
          <article className="moment-tile tile-narrow"><div className="moment-art art-night"><span className="night-star">+</span><span className="night-word">still<br />awake?</span></div><div className="tile-caption"><span>02 / STAY IN THE LOOP</span><p>Your circle, not the whole world.</p></div></article>
          <article className="moment-tile tile-mid"><div className="moment-art art-stilllife"><span className="still-label">little things<br />matter too</span></div><div className="tile-caption"><span>03 / KEEP THE THREAD</span><p>Likes that mean something. Comments that turn into plans.</p></div></article>
        </div>
      </section>
      <section className="welcome-closer">
        <span className="eyebrow">A SMALLER, BETTER INTERNET</span>
        <h2>Come as you<br /><em>are today.</em></h2>
        <Link href={signUpPath} className="button-primary hero-cta" data-testid="button-sign-up-bottom">Make your space <ArrowRight size={17} /></Link>
        <span className="closer-spark">+</span>
      </section>
    </main>
    <footer className="welcome-footer"><Brand /><span>For the people who make the moment.</span><span>© VEMZIRO 2025</span></footer>
  </div>;
}

function NotFound() {
  return <div className="min-h-[100dvh] flex flex-col items-center justify-center text-center p-8 text-[#f3efe8]"><span className="eyebrow">404 — OFF THE MAP</span><h1 className="display-title mt-5">This moment<br /><em>isn’t here.</em></h1><Link href="/" className="button-primary mt-8">Back to the beginning <ArrowRight size={16} /></Link></div>;
}

type Section = 'feed' | 'profile';
function MemberApp() {
  const { user } = useUser();
  const meQuery = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  const me = meQuery.data;
  const [, setLocation] = useLocation();
  const [composerOpen, setComposerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [section, setSection] = useState<Section>('feed');
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    if (me?.username && locationIsProfile()) setSection('profile');
    else setSection('feed');
  }, [me?.username]);

  if (meQuery.isLoading) return <div className="loading-screen"><div className="loading-brand"><Brand /><div className="load-bar" /></div></div>;
  if (meQuery.isError) return <div className="loading-screen"><div className="load-error"><CircleAlert size={24} /><h2>Couldn’t find your space.</h2><p>We couldn’t load your profile just now.</p><button className="button-primary small" onClick={() => meQuery.refetch()}>Try again <ArrowRight size={15} /></button></div></div>;
  if (!me) return <Welcome />;

  return <div className="member-layout">
    <aside className="sidebar">
      <Brand />
      <div className="side-label">YOUR SPACE</div>
      <nav className="side-nav">
        <button className={`side-link ${section === 'feed' ? 'active' : ''}`} onClick={() => { setSection('feed'); setLocation('/'); }} data-testid="nav-feed"><Compass size={18} /><span>Home feed</span><span className="nav-spark">+</span></button>
        <Link href={`/profile/${me.username}`} onClick={() => setSection('profile')} className={`side-link ${section === 'profile' ? 'active' : ''}`} data-testid="nav-profile"><Users size={18} /><span>Your profile</span></Link>
        <button className="side-link" onClick={() => setComposerOpen(true)} data-testid="nav-create"><Plus size={19} /><span>Make a post</span></button>
      </nav>
      <div className="sidebar-bottom">
        <div className="online-note"><span className={`status-led ${health.isError ? 'offline' : ''}`} /><span>{health.isError ? 'Connection a little slow' : 'Your corner is alive'}</span></div>
        <div className="sidebar-person"><Avatar profile={me} size="sm" /><div className="side-person-name"><b>{me.displayName}</b><span>@{me.username}</span></div><UserButton appearance={{ elements: { userButtonAvatarBox: 'user-button-avatar' } }} /></div>
      </div>
    </aside>
    <header className="mobile-header"><Brand compact /><div className="mobile-header-right"><button aria-label="Create post" className="icon-button" onClick={() => setComposerOpen(true)}><Plus size={20} /></button><UserButton /></div></header>
    <main className="member-main">
      <Switch>
        <Route path="/"><FeedPage me={me} onCompose={() => setComposerOpen(true)} /></Route>
        <Route path="/profile/:username"><ProfilePage me={me} onEdit={() => setEditing(true)} /></Route>
        <Route component={NotFound} />
      </Switch>
    </main>
    <aside className={`right-rail ${mobileMenu ? 'rail-open' : ''}`}><div className="rail-top"><span>YOUR VEMZIRO</span><button className="icon-button rail-close" onClick={() => setMobileMenu(false)} aria-label="Close suggestions"><X size={17} /></button></div><SuggestionPanel me={me} /><div className="rail-footer"><span>SMALL CIRCLE. BIG LIFE.</span><span>© VEMZIRO</span></div></aside>
    <button className="mobile-discover" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle people suggestions"><UserRoundPlus size={19} /></button>
    <nav className="mobile-bottom-nav"><button className={section === 'feed' ? 'selected' : ''} onClick={() => { setSection('feed'); setLocation('/'); }}><Compass size={19} /><span>Feed</span></button><button onClick={() => setComposerOpen(true)} className="mobile-add"><Plus size={21} /></button><Link href={`/profile/${me.username}`} className={section === 'profile' ? 'selected' : ''}><Users size={19} /><span>Profile</span></Link></nav>
    {composerOpen && <Composer me={me} onClose={() => setComposerOpen(false)} />}
    {editing && <EditProfile me={me} onClose={() => setEditing(false)} />}
  </div>;
}

function locationIsProfile() { return window.location.pathname.includes('/profile/'); }

function FeedPage({ me, onCompose }: { me: Profile; onCompose: () => void }) {
  const [scope, setScope] = useState<'all' | 'following'>('all');
  const feed = useGetFeed({ scope }, { query: { queryKey: getGetFeedQueryKey({ scope }) } });
  const queryClient = useQueryClient();
  return <div className="feed-column">
    <div className="page-heading"><div><span className="eyebrow">TUESDAY, A GOOD DAY</span><h1>Your <em>circle.</em></h1></div><div className="feed-heading-actions"><button className="icon-button" onClick={() => queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey({ scope }) })} aria-label="Refresh feed"><Sparkles size={17} /></button><button className="button-primary small desktop-compose" onClick={onCompose}><Plus size={16} /> Create post</button></div></div>
    <div className="feed-tabs" role="tablist"><button className={scope === 'all' ? 'selected' : ''} onClick={() => setScope('all')} role="tab" aria-selected={scope === 'all'} data-testid="tab-all-posts">For you</button><button className={scope === 'following' ? 'selected' : ''} onClick={() => setScope('following')} role="tab" aria-selected={scope === 'following'} data-testid="tab-following">Following</button><span className="tab-underline" /></div>
    <button className="quick-composer" onClick={onCompose}><Avatar profile={me} size="sm" /><span>What’s a moment worth keeping?</span><span className="quick-plus"><ImagePlus size={17} /></span></button>
    {feed.isLoading && <div className="feed-list">{[1, 2].map((n) => <PostSkeleton key={n} />)}</div>}
    {feed.isError && <div className="state-panel"><CircleAlert size={25} /><h2>The feed took a wrong turn.</h2><p>Your people are still here. Give it another try.</p><button className="button-primary small" onClick={() => feed.refetch()}>Retry feed <ArrowRight size={15} /></button></div>}
    {!feed.isLoading && !feed.isError && !feed.data?.length && <div className="state-panel empty-state"><span className="empty-orbit"><Camera size={22} /></span><h2>{scope === 'following' ? 'Your following feed is quiet.' : 'A fresh page.'}</h2><p>{scope === 'following' ? 'Follow a few people and their moments will show up here.' : 'Share your first moment, or find people to fill your circle.'}</p><button className="button-primary small" onClick={scope === 'following' ? () => setScope('all') : onCompose}>{scope === 'following' ? 'Explore everyone' : 'Share a moment'} <ArrowRight size={15} /></button></div>}
    {!!feed.data?.length && <div className="feed-list">{feed.data.map((post) => <PostCard key={post.id} post={post} me={me} />)}</div>}
    <div className="feed-end"><span className="end-star">+</span><span>That’s the latest from your circle.</span></div>
  </div>;
}

function PostSkeleton() {
  return <div className="post-card skeleton-card"><div className="skeleton-header"><div className="skeleton skeleton-avatar" /><div className="skeleton-lines"><i className="skeleton" /><i className="skeleton" /></div></div><div className="skeleton skeleton-media" /><div className="skeleton skeleton-caption" /></div>;
}

function PostCard({ post, me }: { post: Post; me: Profile }) {
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(post.likedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [likeError, setLikeError] = useState('');
  const like = useToggleLike();
  const queryClient = useQueryClient();
  const { data: storedMedia, refetch: loadStoredMedia } = useGetStorageObject(post.mediaPath, {
    query: { queryKey: getGetStorageObjectQueryKey(post.mediaPath), enabled: false },
  });
  const [fallbackMedia, setFallbackMedia] = useState('');
  useEffect(() => {
    if (storedMedia instanceof Blob) setFallbackMedia(URL.createObjectURL(storedMedia));
  }, [storedMedia]);
  useEffect(() => () => { if (fallbackMedia) URL.revokeObjectURL(fallbackMedia); }, [fallbackMedia]);
  const mediaUrl = `/api/storage${post.mediaPath}`;
  const time = timeAgo(post.createdAt);
  const toggle = () => {
    const oldLiked = liked; const oldCount = likesCount;
    setLiked(!oldLiked); setLikesCount(Math.max(0, oldCount + (oldLiked ? -1 : 1))); setLikeError('');
    like.mutate({ postId: post.id }, {
      onSuccess: (result) => { setLiked(result.liked); setLikesCount(result.likesCount); },
      onError: () => { setLiked(oldLiked); setLikesCount(oldCount); setLikeError('That like didn’t stick. Try once more.'); },
    });
  };
  return <article className="post-card feed-enter" data-testid={`card-post-${post.id}`}>
    <div className="post-header"><Link href={`/profile/${post.author.username}`} className="post-author" data-testid={`link-post-author-${post.id}`}><Avatar profile={post.author} /><span><b>{post.author.displayName}</b><small>@{post.author.username} <i>·</i> {time}</small></span></Link><button className="icon-button" aria-label="Post options" onClick={() => setLikeError('Posts from your circle stay between you.') }><MoreHorizontal size={20} /></button></div>
    {post.caption && <p className="post-caption" data-testid={`text-post-caption-${post.id}`}>{post.caption}</p>}
    <div className="post-media">{post.mediaType === 'video' ? <video src={mediaUrl} controls preload="metadata" onError={() => { void loadStoredMedia().then((r) => { if (r.data instanceof Blob) setFallbackMedia(URL.createObjectURL(r.data)); }); }} /> : <img src={fallbackMedia || mediaUrl} alt={post.caption || `A moment shared by ${post.author.displayName}`} loading="lazy" onError={() => { if (!fallbackMedia) void loadStoredMedia(); }} />}<span className="media-stamp">{post.mediaType === 'video' ? <Film size={12} /> : <Camera size={12} />} VEMZIRO MOMENT</span></div>
    <div className="post-actions"><button className={`post-action ${liked ? 'liked' : ''}`} onClick={toggle} disabled={like.isPending} aria-label={liked ? 'Unlike post' : 'Like post'} data-testid={`button-like-${post.id}`}><Heart size={19} fill={liked ? 'currentColor' : 'none'} /><span>{likesCount}</span></button><button className="post-action" onClick={() => setShowComments(!showComments)} data-testid={`button-comments-${post.id}`}><MessageCircle size={19} /><span>{post.commentsCount}</span></button><span className="post-action-note">{liked ? 'You’re in this moment' : 'Be part of the moment'}</span></div>
    {likeError && <p className="inline-error">{likeError}</p>}
    {showComments && <Comments post={post} me={me} />}
  </article>;
}

function Comments({ post, me }: { post: Post; me: Profile }) {
  const comments = useGetComments(post.id, { query: { queryKey: getGetCommentsQueryKey(post.id), enabled: true } });
  const create = useCreateComment();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean || clean.length > 1000) return;
    setError('');
    create.mutate({ postId: post.id, data: { text: clean } }, {
      onSuccess: () => {
        setText('');
        queryClient.invalidateQueries({ queryKey: getGetCommentsQueryKey(post.id) });
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey({ scope: 'all' }) });
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey({ scope: 'following' }) });
      },
      onError: () => setError('Your comment didn’t send. Try again.'),
    });
  };
  return <div className="comments-panel">
    <span className="comments-label">THE CONVERSATION</span>
    {comments.isLoading && <div className="comment-loading"><i className="skeleton" /><i className="skeleton" /></div>}
    {comments.isError && <div className="comments-error"><span>Couldn’t load comments.</span><button onClick={() => comments.refetch()}>Retry</button></div>}
    {!comments.isLoading && !comments.isError && comments.data?.length === 0 && <p className="no-comments">A quiet start. Leave the first note.</p>}
    {comments.data?.map((comment) => <CommentRow key={comment.id} comment={comment} />)}
    <form className="comment-form" onSubmit={submit}><Avatar profile={me} size="sm" /><input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Leave a little note…" aria-label="Write a comment" data-testid={`input-comment-${post.id}`} /><button disabled={!text.trim() || create.isPending} aria-label="Send comment" data-testid={`button-send-comment-${post.id}`}><Send size={16} /></button></form>
    {error && <span className="inline-error">{error}</span>}
  </div>;
}

function CommentRow({ comment }: { comment: Comment }) {
  return <div className="comment-row"><Avatar profile={comment.author} size="sm" /><div><p><b>{comment.author.displayName}</b><span>{comment.text}</span></p><small>{timeAgo(comment.createdAt)}</small></div></div>;
}

function Composer({ me, onClose }: { me: Profile; onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const requestUpload = useRequestUploadUrl();
  const createPost = useCreatePost();
  const queryClient = useQueryClient();
  const mediaType = file?.type.startsWith('video/') ? 'video' : 'image';
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith('image/') && !selected.type.startsWith('video/')) { setError('Choose an image or video file.'); return; }
    if (selected.size > 100 * 1024 * 1024) { setError('That file is larger than 100 MB.'); return; }
    setFile(selected); setError('');
  };
  const publish = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) { setError('Add a photo or video to share your moment.'); return; }
    setUploading(true); setError('');
    try {
      const uploaded = await requestUpload.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type } });
      const response = await fetch(uploaded.uploadURL, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Upload could not finish.');
      await createPost.mutateAsync({ data: { mediaPath: uploaded.objectPath, mediaType, caption: caption.trim() || null } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey({ scope: 'all' }) }),
        queryClient.invalidateQueries({ queryKey: getGetFeedQueryKey({ scope: 'following' }) }),
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(me.username) }),
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() }),
      ]);
      onClose();
    } catch {
      setError('Your moment didn’t make it through. Check your connection and try again.');
    } finally { setUploading(false); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
      <div className="modal-head"><div><span className="eyebrow">MAKE A MOMENT</span><h2 id="composer-title">A little piece of <em>today.</em></h2></div><button className="icon-button" onClick={onClose} aria-label="Close composer"><X size={19} /></button></div>
      <form onSubmit={publish}>
        <div className="composer-user"><Avatar profile={me} /><div><b>{me.displayName}</b><span>Sharing with your circle</span></div></div>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} placeholder="What’s happening around you?" aria-label="Post caption" data-testid="input-post-caption" />
        {preview ? <div className="upload-preview">{mediaType === 'video' ? <video src={preview} controls /> : <img src={preview} alt="Preview of selected upload" />}<button type="button" className="remove-upload" onClick={() => setFile(null)} aria-label="Remove selected media"><X size={15} /></button></div> : <button type="button" className="upload-drop" onClick={() => inputRef.current?.click()}><ImagePlus size={25} /><b>Bring a moment in</b><span>Choose a photo or video, up to 100 MB</span><span className="upload-choose">Browse files <ArrowRight size={14} /></span></button>}
        <input ref={inputRef} className="sr-only" type="file" accept="image/*,video/*" onChange={chooseFile} data-testid="input-upload-media" />
        <div className="composer-footer"><span><span className="composer-dot" /> Close friends & your circle</span><span>{caption.length}/2200</span><button className="button-primary small" disabled={uploading || !file} data-testid="button-publish-post">{uploading ? <><LoaderCircle size={15} className="spin" /> Posting</> : <>Share moment <ArrowRight size={15} /></>}</button></div>
        {error && <p className="form-error"><CircleAlert size={14} /> {error}</p>}
      </form>
    </section>
  </div>;
}

function ProfilePage({ me, onEdit }: { me: Profile; onEdit: () => void }) {
  const params = useParams<{ username: string }>();
  const username = params.username || '';
  const profileQuery = useGetProfile(username, { query: { queryKey: getGetProfileQueryKey(username), enabled: !!username } });
  const follow = useToggleFollow();
  const queryClient = useQueryClient();
  const page = profileQuery.data;
  const profile = page?.profile;
  const isMe = username.toLowerCase() === me.username.toLowerCase();
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);
  useEffect(() => setFollowOverride(null), [username]);
  const following = followOverride ?? profile?.isFollowing ?? false;
  const toggle = () => {
    if (!profile) return;
    const previous = following;
    setFollowOverride(!previous);
    follow.mutate({ username }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(username) });
        queryClient.invalidateQueries({ queryKey: getGetProfileSuggestionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      },
      onError: () => setFollowOverride(previous),
    });
  };
  if (profileQuery.isLoading) return <div className="profile-column"><div className="skeleton profile-skeleton-cover" /><PostSkeleton /></div>;
  if (profileQuery.isError || !page || !profile) return <div className="feed-column"><div className="state-panel"><CircleAlert size={25} /><h2>This profile isn’t in reach.</h2><p>Maybe the username changed, or the moment passed.</p><button className="button-primary small" onClick={() => profileQuery.refetch()}>Try again <ArrowRight size={15} /></button></div></div>;
  return <div className="profile-column">
    <div className="profile-cover"><span className="cover-word">VEMZIRO<br />PEOPLE / {profile.username.slice(0, 2).toUpperCase()}</span><span className="cover-orbit">+</span><Link href="/" className="profile-back"><ArrowLeft size={15} /> HOME</Link></div>
    <div className="profile-topline"><Avatar profile={profile} size="lg" />{isMe ? <button className="button-quiet" onClick={onEdit} data-testid="button-edit-profile">Edit profile <span>↗</span></button> : <button className={`button-primary small ${following ? 'following-button' : ''}`} onClick={toggle} disabled={follow.isPending} data-testid="button-follow-profile">{following ? <><Check size={15} /> Following</> : <><Plus size={15} /> Follow</>}</button>}</div>
    <div className="profile-intro"><span className="eyebrow">YOUR CORNER OF THE INTERNET</span><h1>{profile.displayName}</h1><span className="profile-handle">@{profile.username}</span>{profile.bio && <p className="profile-bio">{profile.bio}</p>}</div>
    <div className="profile-stats"><div><b>{profile.postsCount}</b><span>moments</span></div><div><b>{profile.followersCount}</b><span>people here</span></div><div><b>{profile.followingCount}</b><span>following</span></div></div>
    <div className="gallery-heading"><span>THE MOMENTS</span><span>{page.posts.length.toString().padStart(2, '0')} / ARCHIVE</span></div>
    {!page.posts.length ? <div className="gallery-empty"><Camera size={22} /><h2>No moments here yet.</h2><p>The best ones are still on their way.</p></div> : <div className="profile-gallery">{page.posts.map((post) => <GalleryTile key={post.id} post={post} />)}</div>}
  </div>;
}

function GalleryTile({ post }: { post: Post }) {
  const src = `/api/storage${post.mediaPath}`;
  return <div className="gallery-tile" data-testid={`tile-profile-post-${post.id}`}>{post.mediaType === 'video' ? <video src={src} preload="metadata" /> : <img src={src} loading="lazy" alt={post.caption || 'Profile moment'} />}<div className="gallery-hover"><span>{post.mediaType === 'video' && <Film size={13} />} {post.caption || 'A moment, saved.'}</span><span><Heart size={13} /> {post.likesCount}</span></div></div>;
}

function SuggestionPanel({ me }: { me: Profile }) {
  const suggestions = useGetProfileSuggestions({ query: { queryKey: getGetProfileSuggestionsQueryKey() } });
  const follow = useToggleFollow();
  const [followed, setFollowed] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const profiles = useMemo(() => suggestions.data?.filter((p) => p.username !== me.username) || [], [suggestions.data, me.username]);
  return <section className="suggestions"><div className="suggestions-title"><span>PEOPLE YOU MIGHT LIKE</span><span className="suggestions-asterisk">+</span></div>
    {suggestions.isLoading && <div className="suggestion-loading">{[1, 2, 3].map((i) => <div key={i}><i className="skeleton" /><span><i className="skeleton" /><i className="skeleton" /></span></div>)}</div>}
    {suggestions.isError && <div className="suggestion-error"><span>Suggestions are taking a breather.</span><button onClick={() => suggestions.refetch()}>Try again</button></div>}
    {!suggestions.isLoading && !suggestions.isError && !profiles.length && <div className="suggestion-empty"><span className="tiny-orbit">+</span><p>Your circle is looking good.<br />New faces show up here.</p></div>}
    {profiles.slice(0, 5).map((profile) => {
      const isFollowing = followed.includes(profile.username) || profile.isFollowing;
      return <div className="suggestion-person" key={profile.id} data-testid={`suggestion-${profile.username}`}><Link href={`/profile/${profile.username}`} className="suggestion-avatar-link"><Avatar profile={profile} size="sm" /></Link><Link href={`/profile/${profile.username}`} className="suggestion-name"><b>{profile.displayName}</b><span>@{profile.username}</span></Link><button className={`suggestion-follow ${isFollowing ? 'is-following' : ''}`} aria-label={`${isFollowing ? 'Following' : 'Follow'} ${profile.displayName}`} onClick={() => {
        if (isFollowing) return;
        setFollowed((prev) => [...prev, profile.username]);
        follow.mutate({ username: profile.username }, {
          onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetProfileSuggestionsQueryKey() }); },
          onError: () => setFollowed((prev) => prev.filter((name) => name !== profile.username)),
        });
      }} disabled={isFollowing || follow.isPending}><Plus size={15} /></button></div>;
    })}
    <div className="suggestion-footnote">GOOD PEOPLE FIND GOOD PEOPLE <ArrowRight size={12} /></div>
  </section>;
}

function EditProfile({ me, onClose }: { me: Profile; onClose: () => void }) {
  const [displayName, setDisplayName] = useState(me.displayName);
  const [username, setUsername] = useState(me.username);
  const [bio, setBio] = useState(me.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl || '');
  const [error, setError] = useState('');
  const update = useUpdateMyProfile();
  const queryClient = useQueryClient();
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (username.length < 3 || !/^[a-zA-Z0-9_.]+$/.test(username)) { setError('Use 3–30 letters, numbers, dots or underscores for your username.'); return; }
    if (!displayName.trim() || displayName.length > 60 || bio.length > 300) { setError('Check that your display name and bio are within their limits.'); return; }
    setError('');
    update.mutate({ data: { username, displayName: displayName.trim(), bio: bio.trim() || null, avatarUrl: avatarUrl.trim() || null } }, {
      onSuccess: async (profile) => {
        await Promise.all([
          queryClient.setQueryData(getGetMyProfileQueryKey(), profile),
          queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey(profile.username) }),
          queryClient.invalidateQueries({ queryKey: getGetProfileSuggestionsQueryKey() }),
        ]);
        onClose();
      },
      onError: () => setError('We couldn’t save those changes. Please try again.'),
    });
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-profile-heading">
      <div className="modal-head"><div><span className="eyebrow">MAKE YOURS, YOURS</span><h2 id="edit-profile-heading">Edit your <em>profile.</em></h2></div><button className="icon-button" onClick={onClose} aria-label="Close edit profile"><X size={19} /></button></div>
      <div className="edit-person"><Avatar profile={{ ...me, displayName, username, avatarUrl: avatarUrl || null }} size="lg" /><div><b>{displayName || 'Your name'}</b><span>@{username || 'your-handle'}</span></div></div>
      <form className="edit-form" onSubmit={save}>
        <label>Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} required data-testid="input-display-name" /></label>
        <label>Username<div className="handle-input"><AtSign size={15} /><input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={30} required data-testid="input-username" /></div></label>
        <label>Avatar image URL<input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} type="url" placeholder="https://…" data-testid="input-avatar-url" /></label>
        <label>Your little bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} placeholder="A little about you…" data-testid="input-bio" /><span className="field-count">{bio.length}/300</span></label>
        {error && <p className="form-error"><CircleAlert size={14} /> {error}</p>}
        <div className="edit-actions"><button type="button" className="button-quiet" onClick={onClose}>Cancel</button><button className="button-primary small" disabled={update.isPending} data-testid="button-save-profile">{update.isPending ? <><LoaderCircle size={15} className="spin" /> Saving</> : <>Save changes <ArrowRight size={15} /></>}</button></div>
      </form>
    </section>
  </div>;
}

function timeAgo(date: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(date));
}

export default AppRoot;
